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

import AnalysisOptions from "./types/AnalysisOptions";
import { StateTreeNode } from "@/types/StateTreeNode";
import { Classification, classifValues } from "@/constants/Classification";
import {
    extractPreviousStateTreeNode,
    extractCurrentStateTreeNode
} from "./utils/extractNode";

import { getOpeningName } from "./utils/opening";
import { pointLossClassify } from "./classification/pointLoss";
import { considerBrilliantClassification } from "./classification/brilliant";
import { considerCriticalClassification } from "./classification/critical";

export function classify(
    node: StateTreeNode,
    options?: AnalysisOptions
) {
    if (!node.parent) {
        throw new Error("no parent node exists to compare with.");
    }

    const previous = extractPreviousStateTreeNode(node.parent);
    const current = extractCurrentStateTreeNode(node);

    if (!previous || !current) {
        throw new Error("information missing from current or previous node.");
    }

    const opts: Required<AnalysisOptions> = {
        includeBrilliant: true,
        includeCritical: true,
        includeTheory: true,
        ...options
    };

    // Consider forced classification
    if (previous.board.moves().length <= 1) {
        return Classification.FORCED;
    }

    // Consider theory classification
    const openingName = getOpeningName(current.state.fen);

    if (opts.includeTheory && openingName) {
        return Classification.THEORY;
    }

    // Short-circuit checkmates with best
    if (current.board.isCheckmate()) {
        return Classification.BEST;
    }

    const topMovePlayed = previous.topMove.san == current.playedMove.san;

    // Point loss classify
    let classification = topMovePlayed
        ? Classification.BEST
        : pointLossClassify(previous, current);

    // Consider only and brilliant classification
    if (
        opts.includeCritical
        && topMovePlayed
        && considerCriticalClassification(previous, current)
    ) classification = Classification.CRITICAL;

    if (
        opts.includeBrilliant
        && classifValues[classification] >= classifValues[Classification.BEST]
        && considerBrilliantClassification(previous, current)
    ) classification = Classification.BRILLIANT;

    return classification;
}
