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

import { meanBy } from "lodash";

import { getNodeChain, StateTreeNode } from "@/types/StateTreeNode";
import Evaluation from "@/types/Evaluation";
import PieceColour from "@/constants/PieceColour";
import { getExpectedPointsLoss } from "./expectedPoints";

export function getGameAccuracy(rootNode: StateTreeNode) {
    const accuracyHolders = getNodeChain(rootNode).filter(
        node => node.state.accuracy != undefined
    );

    const whiteNodes = accuracyHolders.filter(
        node => node.state.moveColour == PieceColour.WHITE
    );

    const blackNodes = accuracyHolders.filter(
        node => node.state.moveColour == PieceColour.BLACK
    );

    return {
        white: meanBy(whiteNodes, node => node.state.accuracy!),
        black: meanBy(blackNodes, node => node.state.accuracy!)
    };
}

export function getMoveAccuracy(
    previousEvaluation: Evaluation,
    currentEvaluation: Evaluation,
    moveColour: PieceColour
) {
    const pointLoss = getExpectedPointsLoss(
        previousEvaluation,
        currentEvaluation,
        moveColour
    );

    return 103.16 * Math.exp(-4 * pointLoss) - 3.17;
}
