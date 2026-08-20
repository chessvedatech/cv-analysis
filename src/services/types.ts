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

import { Classification } from "@/constants/Classification";
import { SerializedStateTreeNode } from "@/types/StateTreeNode";

export type MoveClassification = `${Classification}`;

export type GamePhase = "opening" | "middlegame" | "endgame";

export interface MoveAnalysis {
    moveIndex: number;
    /** Which player made this move; do not infer it from moveIndex parity,
     *  since a review can start from a black-to-move position. */
    moveColour: "white" | "black";
    san: string;
    from: string;
    to: string;
    fen: string;
    /** White-relative centipawns; ±10000 stands in for a forced mate. */
    evaluation: number;
    /** Best move in the position *before* this one was played. */
    bestMove: string;
    bestMoveSan: string;
    classification: MoveClassification;
    evalDiff: number;
    cpLoss: number;
    /** WintrChess per-move accuracy, 0-100. */
    accuracy: number;
    winChance: number;
    whiteWinChance: number;
    blackWinChance: number;
    isMate: boolean;
    mateIn: number | null;
    phase: GamePhase;
    /** Opening name for the position this move reached, when it is book. */
    opening?: string;
}

export interface MoveSummary {
    brilliant: number;
    critical: number;
    best: number;
    excellent: number;
    okay: number;
    inaccuracy: number;
    mistake: number;
    blunder: number;
    theory: number;
    forced: number;
    risky: number;
    avgCentipawnLoss: number;
}

export interface PhaseStats {
    moveCount: number;
    accuracyWhite: number;
    accuracyBlack: number;
    avgCpLossWhite: number;
    avgCpLossBlack: number;
}

export interface PhaseAnalysis {
    opening: PhaseStats;
    middlegame: PhaseStats;
    endgame: PhaseStats;
}

export interface GameReport {
    gameId: string;
    engine: {
        name: string;
        depth: number;
        multiPv: number;
    };
    moves: MoveAnalysis[];
    summary: {
        white: MoveSummary;
        black: MoveSummary;
    };
    averageAccuracy: {
        white: number;
        black: number;
    };
    phaseAnalysis: PhaseAnalysis;
    /** Deepest opening book entry the game reached. */
    opening: { name: string; ply: number } | null;
    /** Full position tree, included only when the caller asks for it. */
    stateTree?: SerializedStateTreeNode;
}

export interface PositionReport {
    fen: string;
    depth: number;
    evaluation: number;
    isMate: boolean;
    mateIn: number | null;
    bestMove: string;
    bestMoveSan: string;
    whiteWinChance: number;
    lines: Array<{
        index: number;
        depth: number;
        evaluation: number;
        isMate: boolean;
        mateIn: number | null;
        moves: Array<{ san: string; uci: string }>;
    }>;
    opening?: string;
}
