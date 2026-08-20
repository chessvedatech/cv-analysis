/*
 * cv-analysis — Chessveda's chess analysis service
 * Copyright (C) 2026 Midas 24x7 Games Private Limited
 *
 * This file is derived from WintrChess
 * (https://github.com/WintrCat/wintrchess), Copyright (C) WintrCat and
 * contributors, and was modified by Midas 24x7 Games Private Limited
 * in 2026. See the NOTICE file for the list of derived files and what
 * changed.
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

import {
    PieceSymbol,
    PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING
} from "chess.js";

import Evaluation from "@/types/Evaluation";

export const STARTING_FEN =
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const defaultEvaluation: Evaluation = {
    type: "centipawn",
    value: 0
};

export const pieceNames: Record<PieceSymbol, string> = {
    [PAWN]: "Pawn",
    [KNIGHT]: "Knight",
    [BISHOP]: "Bishop",
    [ROOK]: "Rook",
    [QUEEN]: "Queen",
    [KING]: "King"
};

export const pieceValues: Record<PieceSymbol, number> = {
    [PAWN]: 1,
    [KNIGHT]: 3,
    [BISHOP]: 3,
    [ROOK]: 5,
    [QUEEN]: 9,
    [KING]: Infinity
};
