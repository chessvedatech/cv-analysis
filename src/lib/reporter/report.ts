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

import { GameAnalysis } from "@/types/GameAnalysis";
import { StateTreeNode, getNodeChain } from "@/types/StateTreeNode";
import AnalysisOptions from "./types/AnalysisOptions";
import { adaptPieceColour } from "@/constants/PieceColour";
import {
    extractCurrentStateTreeNode,
    extractPreviousStateTreeNode
} from "./utils/extractNode";
import { getOpeningName } from "./utils/opening";
import { getMoveAccuracy } from "./accuracy";
import { classify } from "./classify";

export function getGameAnalysis(
    rootNode: StateTreeNode,
    options?: AnalysisOptions
): GameAnalysis {
    const treeNodes = getNodeChain(rootNode);

    for (const node of treeNodes) {
        try {
            node.state.classification = classify(node, options);
        } catch {
            node.state.classification = undefined;
        }

        node.state.opening = getOpeningName(node.state.fen);

        if (!node.parent) continue;

        const previous = extractPreviousStateTreeNode(node.parent);
        const current = extractCurrentStateTreeNode(node);

        if (!previous || !current) continue;

        node.state.accuracy = getMoveAccuracy(
            previous.evaluation,
            current.evaluation,
            adaptPieceColour(current.playedMove.color)
        );
    }

    return {
        stateTree: rootNode
    };
}
