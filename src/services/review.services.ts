/*
 * cv-analysis — Chessveda's chess analysis service
 * Copyright (C) 2026 Midas 24x7 Games Private Limited
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details. You should have received a copy of the licence along with
 * this program; see the LICENSE file.
 */

import { Chess } from "chess.js";
import { meanBy, uniqueId } from "lodash";

import config from "@/config";
import logger from "@/lib/utils/logger";
import Semaphore from "@/lib/utils/semaphore";
import enginePool from "@/engine/pool";
import { StockfishEngine } from "@/engine/stockfish";
import { Classification } from "@/constants/Classification";
import PieceColour from "@/constants/PieceColour";
import { STARTING_FEN } from "@/constants/utils";
import Evaluation from "@/types/Evaluation";
import { EngineLine, getTopEngineLine } from "@/types/EngineLine";
import {
    StateTreeNode,
    getNodeChain,
    serializeNode
} from "@/types/StateTreeNode";
import { getGameAnalysis } from "@/lib/reporter/report";
import { getExpectedPoints } from "@/lib/reporter/expectedPoints";
import { getOpeningName } from "@/lib/reporter/utils/opening";
import {
    GamePhase,
    GameReport,
    MoveAnalysis,
    MoveClassification,
    MoveSummary,
    PhaseAnalysis,
    PhaseStats
} from "./types";

export interface ReviewRequest {
    gameId: string;
    moves: Array<{ san: string; from?: string; to?: string }>;
    initialFen?: string;
    depth?: number;
    multiPv?: number;
    includeBrilliant?: boolean;
    includeCritical?: boolean;
    includeTheory?: boolean;
    includeStateTree?: boolean;
}

/** Stands in for a forced mate on the centipawn scale the UI plots. */
const MATE_SCORE = 10000;

/**
 * Centipawn loss is capped so a single catastrophic blunder cannot dominate
 * average centipawn loss for the whole game.
 */
const MAX_CP_LOSS = 400;

const reviewSemaphore = new Semaphore(
    Math.max(1, config.limits.maxConcurrentReviews)
);

const emptySummary = (): MoveSummary => ({
    brilliant: 0,
    critical: 0,
    best: 0,
    excellent: 0,
    okay: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    theory: 0,
    forced: 0,
    risky: 0,
    avgCentipawnLoss: 0
});

const emptyPhase = (): PhaseStats => ({
    moveCount: 0,
    accuracyWhite: 0,
    accuracyBlack: 0,
    avgCpLossWhite: 0,
    avgCpLossBlack: 0
});

/** Clamps a raw WintrChess accuracy (which can undershoot 0) to 0-100. */
function clampAccuracy(accuracy: number) {
    return Math.round(Math.max(0, Math.min(100, accuracy)) * 100) / 100;
}

/**
 * White-relative centipawns for plotting, with mates pinned to ±MATE_SCORE.
 *
 * A mate value of 0 means "the side to move is mated here", which carries no
 * sign of its own — the winner is whoever played the move that reached the
 * position, so `deliveredBy` supplies it. Without that, a checkmate would plot
 * as a dead-even 0.00 on the evaluation bar and graph.
 */
function toCentipawns(evaluation: Evaluation, deliveredBy?: PieceColour) {
    if (evaluation.type == "centipawn") return evaluation.value;

    if (evaluation.value == 0) {
        if (!deliveredBy) return 0;
        return deliveredBy == PieceColour.WHITE ? MATE_SCORE : -MATE_SCORE;
    }

    return evaluation.value > 0 ? MATE_SCORE : -MATE_SCORE;
}

/**
 * Determines the game phase. The opening is the first ten moves per side;
 * after that a position counts as an endgame once the queens are gone and
 * material is thin, or when very few pieces remain at all.
 */
function determinePhase(fen: string, ply: number): GamePhase {
    if (ply < 20) return "opening";

    const board = new Chess(fen);

    let queens = 0;
    let totalPieces = 0;

    for (const row of board.board()) {
        for (const square of row) {
            if (!square) continue;

            totalPieces++;
            if (square.type == "q") queens++;
        }
    }

    const veryFewPieces = totalPieces <= 8;
    const queensTraded = queens === 0;
    const limitedMaterial = totalPieces <= 10;

    if (veryFewPieces || (queensTraded && limitedMaterial)) {
        return "endgame";
    }

    return "middlegame";
}

/**
 * Walks the move list, evaluating every distinct position exactly once. The
 * position after move i is the position before move i + 1, so a game of N
 * moves costs N + 1 searches rather than 2N.
 */
async function buildStateTree(
    request: ReviewRequest,
    depth: number,
    multiPv: number
): Promise<{ root: StateTreeNode; searches: number }> {
    const initialFen = request.initialFen || STARTING_FEN;

    const evaluate = (fen: string) => enginePool.withEngine(
        (engine: StockfishEngine) => engine.evaluate(fen, { depth, multiPv })
    );

    const root: StateTreeNode = {
        id: uniqueId("node-"),
        mainline: true,
        parent: undefined,
        children: [],
        state: {
            fen: initialFen,
            engineLines: await evaluate(initialFen)
        }
    };

    const board = new Chess(initialFen);
    let current = root;
    let searches = 1;

    for (const move of request.moves) {
        let played;

        try {
            played = board.move(move.san);
        } catch {
            // An illegal or malformed SAN truncates the review rather than
            // failing it — the moves analysed so far are still valid.
            logger.warn(
                `review ${request.gameId}: stopping at illegal move `
                + `"${move.san}"`
            );
            break;
        }

        const fen = played.after;

        const child: StateTreeNode = {
            id: uniqueId("node-"),
            mainline: true,
            parent: current,
            children: [],
            state: {
                fen,
                engineLines: await evaluate(fen),
                move: { san: played.san, uci: played.lan },
                moveColour: played.color == "w"
                    ? PieceColour.WHITE
                    : PieceColour.BLACK
            }
        };

        searches++;
        current.children.push(child);
        current = child;
    }

    return { root, searches };
}

/** Extracts the first line of a node, which carries the engine's best move. */
function topLineOf(lines: EngineLine[]): EngineLine | undefined {
    return getTopEngineLine(lines);
}

/**
 * Flattens the classified position tree into the per-move array the Chessveda
 * clients render.
 */
function toMoveAnalyses(root: StateTreeNode): MoveAnalysis[] {
    const chain = getNodeChain(root);
    const analyses: MoveAnalysis[] = [];

    for (let index = 1; index < chain.length; index++) {
        const node = chain[index];
        const parent = chain[index - 1];

        const move = node.state.move;
        if (!move) continue;

        const topLine = topLineOf(node.state.engineLines);
        const parentTopLine = topLineOf(parent.state.engineLines);

        if (!topLine) continue;

        const moveColour = node.state.moveColour ?? (
            index % 2 === 1 ? PieceColour.WHITE : PieceColour.BLACK
        );
        const isWhiteMove = moveColour == PieceColour.WHITE;
        const sign = isWhiteMove ? 1 : -1;

        const evaluation = toCentipawns(topLine.evaluation, moveColour);
        const previousEvaluation = parentTopLine
            ? toCentipawns(
                parentTopLine.evaluation,
                // The parent was reached by the opponent's move.
                moveColour == PieceColour.WHITE
                    ? PieceColour.BLACK
                    : PieceColour.WHITE
            )
            : 0;

        // Both evaluations are white-relative; flipping them into the mover's
        // frame makes the loss a plain subtraction for either colour.
        const cpLoss = Math.min(
            MAX_CP_LOSS,
            Math.max(0, (previousEvaluation - evaluation) * sign)
        );

        const whiteWinChance = Math.round(
            getExpectedPoints(topLine.evaluation, { moveColour }) * 100
        );
        const blackWinChance = 100 - whiteWinChance;

        const bestMove = parentTopLine?.moves.at(0);

        analyses.push({
            moveIndex: index - 1,
            moveColour,
            san: move.san,
            from: move.uci.slice(0, 2),
            to: move.uci.slice(2, 4),
            fen: node.state.fen,
            evaluation,
            bestMove: bestMove?.uci ?? "",
            bestMoveSan: bestMove?.san ?? "",
            classification: (node.state.classification
                ?? Classification.OKAY) as MoveClassification,
            evalDiff: (evaluation - previousEvaluation) * sign,
            cpLoss,
            accuracy: clampAccuracy(node.state.accuracy ?? 0),
            winChance: isWhiteMove ? whiteWinChance : blackWinChance,
            whiteWinChance,
            blackWinChance,
            isMate: topLine.evaluation.type == "mate",
            mateIn: topLine.evaluation.type == "mate"
                ? topLine.evaluation.value
                : null,
            phase: determinePhase(node.state.fen, index - 1),
            opening: node.state.opening
        });
    }

    return analyses;
}

/**
 * Extends `theory` across the gaps inside an opening sequence.
 *
 * The reporter marks a move as theory when the position it reaches is named
 * in the book. Books only name the positions where a recognised line is
 * *reached*, so a sequence that is entirely theory still comes back with
 * holes — after 1.e4 d5 the position after 2...Qxd5 is named but the one
 * after 2.exd5 is not, leaving the recapture classified as an ordinary move
 * in the middle of a book line.
 *
 * Every move up to the deepest book position is therefore treated as book.
 * This lives here rather than in the reporter so the ported classification
 * logic stays faithful to its upstream, and so both of Chessveda's review
 * producers agree on what counts as a book move.
 */
function fillTheoryGaps(moves: MoveAnalysis[]): MoveAnalysis[] {
    let deepest = -1;

    moves.forEach((move, index) => {
        if (move.classification == Classification.THEORY || move.opening) {
            deepest = index;
        }
    });

    if (deepest < 0) return moves;

    let lastOpening: string | undefined;

    return moves.map((move, index) => {
        if (index > deepest) return move;

        lastOpening = move.opening ?? lastOpening;

        // `forced` outranks book: that a move was the only legal one says
        // more about the position than its also being theory.
        if (move.classification == Classification.FORCED) return move;

        return {
            ...move,
            classification: Classification.THEORY as MoveClassification,
            opening: lastOpening
        };
    });
}

function summarise(moves: MoveAnalysis[]): MoveSummary {
    const summary = emptySummary();

    for (const move of moves) {
        // Every classification the reporter can produce has a matching
        // counter, so an unknown key here means the two drifted apart.
        if (move.classification in summary) {
            summary[move.classification as keyof MoveSummary]++;
        }
    }

    summary.avgCentipawnLoss = moves.length
        ? Math.round(meanBy(moves, move => move.cpLoss) * 100) / 100
        : 0;

    return summary;
}

function buildPhaseAnalysis(moves: MoveAnalysis[]): PhaseAnalysis {
    const phases: PhaseAnalysis = {
        opening: emptyPhase(),
        middlegame: emptyPhase(),
        endgame: emptyPhase()
    };

    for (const phase of ["opening", "middlegame", "endgame"] as const) {
        const phaseMoves = moves.filter(move => move.phase == phase);

        const white = phaseMoves.filter(move => move.moveColour == "white");
        const black = phaseMoves.filter(move => move.moveColour == "black");

        phases[phase] = {
            moveCount: phaseMoves.length,
            accuracyWhite: white.length
                ? clampAccuracy(meanBy(white, move => move.accuracy))
                : 0,
            accuracyBlack: black.length
                ? clampAccuracy(meanBy(black, move => move.accuracy))
                : 0,
            avgCpLossWhite: white.length
                ? Math.round(meanBy(white, move => move.cpLoss) * 100) / 100
                : 0,
            avgCpLossBlack: black.length
                ? Math.round(meanBy(black, move => move.cpLoss) * 100) / 100
                : 0
        };
    }

    return phases;
}

/** The deepest book position the game reached, used as the opening label. */
function resolveOpening(root: StateTreeNode) {
    let opening: { name: string; ply: number } | null = null;

    const chain = getNodeChain(root);

    for (let ply = 0; ply < chain.length; ply++) {
        const node = chain[ply];
        const name = node.state.opening ?? getOpeningName(node.state.fen);

        if (name) opening = { name, ply };
    }

    return opening;
}

async function runReview(request: ReviewRequest): Promise<GameReport> {
    const depth = Math.max(
        config.search.minDepth,
        Math.min(config.search.maxDepth, request.depth ?? config.search.defaultDepth)
    );

    // The classifier reads the second-best line to decide `critical` and
    // `brilliant`, so MultiPV can never drop below 2 without silently
    // disabling those classifications.
    const multiPv = Math.max(
        2,
        Math.min(config.search.maxMultiPv, request.multiPv ?? config.search.defaultMultiPv)
    );

    const started = Date.now();

    const { root, searches } = await buildStateTree(request, depth, multiPv);

    getGameAnalysis(root, {
        includeBrilliant: request.includeBrilliant ?? true,
        includeCritical: request.includeCritical ?? true,
        includeTheory: request.includeTheory ?? true
    });

    const moves = fillTheoryGaps(toMoveAnalyses(root));

    const whiteMoves = moves.filter(move => move.moveColour == "white");
    const blackMoves = moves.filter(move => move.moveColour == "black");

    logger.info(
        `review ${request.gameId}: ${moves.length} moves, ${searches} searches, `
        + `depth ${depth}, ${Date.now() - started}ms`
    );

    return {
        gameId: request.gameId,
        engine: { name: "stockfish", depth, multiPv },
        moves,
        summary: {
            white: summarise(whiteMoves),
            black: summarise(blackMoves)
        },
        averageAccuracy: {
            white: whiteMoves.length
                ? clampAccuracy(meanBy(whiteMoves, move => move.accuracy))
                : 0,
            black: blackMoves.length
                ? clampAccuracy(meanBy(blackMoves, move => move.accuracy))
                : 0
        },
        phaseAnalysis: buildPhaseAnalysis(moves),
        opening: resolveOpening(root),
        stateTree: request.includeStateTree
            ? serializeNode(root)
            : undefined
    };
}

/**
 * Reviews a whole game: evaluates every position with Stockfish, classifies
 * each move with the WintrChess reporter, and returns the flattened report.
 */
export async function reviewGame(request: ReviewRequest): Promise<GameReport> {
    if (request.moves.length > config.limits.maxMoves) {
        throw Object.assign(
            new Error(
                `game exceeds the ${config.limits.maxMoves} half-move limit`
            ),
            { statusCode: 400 }
        );
    }

    return reviewSemaphore.run(() => Promise.race([
        runReview(request),
        new Promise<never>((_, reject) => setTimeout(
            () => reject(Object.assign(
                new Error("review timed out"),
                { statusCode: 504 }
            )),
            config.limits.reviewTimeoutMs
        ).unref())
    ]));
}

export function reviewQueueStats() {
    return {
        inFlight: reviewSemaphore.inFlight,
        queued: reviewSemaphore.pending
    };
}
