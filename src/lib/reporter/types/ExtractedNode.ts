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

import { Chess, Move } from "chess.js";

import { BoardState } from "@/types/BoardState";
import { EngineLine } from "@/types/EngineLine";
import Evaluation from "@/types/Evaluation";

export interface ExtractedNode {
    board: Chess;
    state: BoardState;
    topLine: EngineLine;
    evaluation: Evaluation;
    secondTopLine?: EngineLine;
    secondTopMove?: Move;
    secondSubjectiveEvaluation?: Evaluation;
}

export interface ExtractedPreviousNode extends ExtractedNode {
    topMove: Move;
    subjectiveEvaluation?: Evaluation;
    playedMove?: Move;
}

export interface ExtractedCurrentNode extends ExtractedNode {
    topMove?: Move;
    subjectiveEvaluation: Evaluation;
    playedMove: Move;
}
