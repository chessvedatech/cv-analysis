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

import config from "@/config";
import enginePool from "@/engine/pool";
import { getTopEngineLine } from "@/types/EngineLine";
import Evaluation from "@/types/Evaluation";
import PieceColour from "@/constants/PieceColour";
import { getExpectedPoints } from "@/lib/reporter/expectedPoints";
import { getOpeningName } from "@/lib/reporter/utils/opening";
import { PositionReport } from "./types";

const MATE_SCORE = 10000;

/**
 * A mate value of 0 means the side to move is already mated, so the position
 * is won for the other side — `whiteToMove` resolves which.
 */
function toCentipawns(evaluation: Evaluation, whiteToMove: boolean) {
    if (evaluation.type == "centipawn") return evaluation.value;
    if (evaluation.value == 0) return whiteToMove ? -MATE_SCORE : MATE_SCORE;

    return evaluation.value > 0 ? MATE_SCORE : -MATE_SCORE;
}

export interface PositionRequest {
    fen: string;
    depth?: number;
    multiPv?: number;
}

/**
 * Evaluates a single position. Used for the board's live engine readout,
 * where the caller wants the top lines rather than a classified game.
 */
export async function analysePosition(
    request: PositionRequest
): Promise<PositionReport> {
    // Rejecting here keeps a malformed FEN from reaching Stockfish, which
    // would otherwise sit on the previous position and return a stale score.
    let board: Chess;

    try {
        board = new Chess(request.fen);
    } catch {
        throw Object.assign(
            new Error("invalid FEN"),
            { statusCode: 400 }
        );
    }

    const depth = Math.max(
        config.search.minDepth,
        Math.min(
            config.search.maxDepth,
            request.depth ?? config.search.defaultDepth
        )
    );

    const multiPv = Math.max(
        1,
        Math.min(
            config.search.maxMultiPv,
            request.multiPv ?? config.search.defaultMultiPv
        )
    );

    const lines = await enginePool.withEngine(
        engine => engine.evaluate(request.fen, { depth, multiPv })
    );

    const topLine = getTopEngineLine(lines);

    if (!topLine) {
        throw Object.assign(
            new Error("engine returned no lines"),
            { statusCode: 502 }
        );
    }

    const bestMove = topLine.moves.at(0);

    const whiteToMove = board.turn() == "w";

    // Win chance is reported for white, so the perspective passed in only
    // matters for the "already mated" case, which belongs to whoever moved
    // last — the opposite of the side to move.
    const moveColour = whiteToMove
        ? PieceColour.BLACK
        : PieceColour.WHITE;

    return {
        fen: request.fen,
        depth: topLine.depth,
        evaluation: toCentipawns(topLine.evaluation, whiteToMove),
        isMate: topLine.evaluation.type == "mate",
        mateIn: topLine.evaluation.type == "mate"
            ? topLine.evaluation.value
            : null,
        bestMove: bestMove?.uci ?? "",
        bestMoveSan: bestMove?.san ?? "",
        whiteWinChance: Math.round(
            getExpectedPoints(topLine.evaluation, { moveColour }) * 100
        ),
        lines: lines.map(line => ({
            index: line.index,
            depth: line.depth,
            evaluation: toCentipawns(line.evaluation, whiteToMove),
            isMate: line.evaluation.type == "mate",
            mateIn: line.evaluation.type == "mate" ? line.evaluation.value : null,
            moves: line.moves
        })),
        opening: getOpeningName(request.fen)
    };
}
