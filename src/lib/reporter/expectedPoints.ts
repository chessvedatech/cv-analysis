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

import Evaluation from "@/types/Evaluation";
import { PieceColour, flipPieceColour } from "@/constants/PieceColour";

interface ExpectedPointsOptions {
    moveColour: PieceColour;
    centipawnGradient?: number;
}

export function getExpectedPoints(
    evaluation: Evaluation,
    options?: ExpectedPointsOptions
) {
    const opts = {
        centipawnGradient: 0.0035,
        ...options
    };

    if (evaluation.type == "mate") {
        if (evaluation.value == 0) {
            return Number(opts.moveColour == PieceColour.WHITE);
        }

        return Number(evaluation.value > 0);
    } else {
        return 1 / (1 + Math.exp(
            -opts.centipawnGradient * evaluation.value
        ));
    }
}

export function getExpectedPointsLoss(
    previousEvaluation: Evaluation,
    currentEvaluation: Evaluation,
    moveColour: PieceColour
) {
    return Math.max(0,
        (
            getExpectedPoints(previousEvaluation, {
                moveColour: flipPieceColour(moveColour)
            })
            - getExpectedPoints(currentEvaluation, { moveColour })
        )
        * (moveColour == PieceColour.WHITE ? 1 : -1)
    );
}
