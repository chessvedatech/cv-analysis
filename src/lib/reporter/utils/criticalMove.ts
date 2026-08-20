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

import { QUEEN } from "chess.js";

import {
    ExtractedCurrentNode,
    ExtractedPreviousNode
} from "../types/ExtractedNode";

/**
 * @description Returns whether a move is critical to maintaining an
 * advantage - moves that are easy to find or forced cannot be critical.
 * Also serves as a preliminary check for critical and brilliant moves.
 */
export function isMoveCriticalCandidate(
    previous: ExtractedPreviousNode,
    current: ExtractedCurrentNode
) {
    // Still completely winning even if this move hadn't been found
    const secondSubjectiveEval = previous.secondSubjectiveEvaluation;

    if (secondSubjectiveEval) {
        if (
            secondSubjectiveEval.type == "centipawn"
            && secondSubjectiveEval.value >= 700
        ) return false;
    } else {
        if (
            current.evaluation.type == "centipawn"
            && current.subjectiveEvaluation.value >= 700
        ) return false;
    }

    // Moves in losing positions cannot be critical
    if (current.subjectiveEvaluation.value < 0) return false;

    // Disallow queen promotions as critical moves
    if (current.playedMove.promotion == QUEEN) return false;

    // Disallow moves that must be played anyway to escape check
    if (previous.board.isCheck()) return false;

    return true;
}
