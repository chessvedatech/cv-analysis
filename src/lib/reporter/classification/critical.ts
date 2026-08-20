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
    ExtractedCurrentNode,
    ExtractedPreviousNode
} from "../types/ExtractedNode";
import { flipPieceColour, adaptPieceColour } from "@/constants/PieceColour";
import { getCaptureSquare } from "@/lib/utils/chess";
import { getExpectedPointsLoss } from "../expectedPoints";
import { isMoveCriticalCandidate } from "../utils/criticalMove";
import { isPieceSafe } from "../utils/pieceSafety";

export function considerCriticalClassification(
    previous: ExtractedPreviousNode,
    current: ExtractedCurrentNode
) {
    if (!isMoveCriticalCandidate(previous, current)) return false;

    // It is not critical to find moves where you have mate
    if (
        current.subjectiveEvaluation.type == "mate"
        && current.subjectiveEvaluation.value > 0
    ) return false;

    // A critical move cannot be a capture of free material
    if (current.playedMove.captured) {
        const capturedPieceSafety = isPieceSafe(
            previous.board,
            {
                color: flipPieceColour(current.playedMove.color),
                square: getCaptureSquare(current.playedMove),
                type: current.playedMove.captured
            }
        );

        if (!capturedPieceSafety) return false;
    }

    if (!previous.secondTopLine?.evaluation) return false;

    const secondTopMovePointLoss = getExpectedPointsLoss(
        previous.evaluation,
        previous.secondTopLine.evaluation,
        adaptPieceColour(current.playedMove.color)
    );

    // 10% loss = middle between inaccuracy and mistake
    return secondTopMovePointLoss >= 0.1;
}
