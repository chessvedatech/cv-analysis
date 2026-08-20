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

import { Chess, WHITE } from "chess.js";

import { StateTreeNode } from "@/types/StateTreeNode";
import {
    EngineLine,
    getLineGroupSibling,
    getTopEngineLine
} from "@/types/EngineLine";
import { RawMove } from "../types/RawMove";
import {
    ExtractedCurrentNode,
    ExtractedPreviousNode
} from "../types/ExtractedNode";
import { adaptPieceColour } from "@/constants/PieceColour";
import { getSubjectiveEvaluation } from "@/lib/utils/chess";

type PieceMovement = Pick<RawMove, "from" | "to" | "promotion">;

function safeMove(fen: string, move: string | PieceMovement) {
    try {
        return new Chess(fen).move(move);
    } catch {
        return undefined;
    }
}

function extractSecondTopMove(node: StateTreeNode, topLine: EngineLine) {
    const secondTopLine = getLineGroupSibling(
        node.state.engineLines,
        topLine,
        2
    );

    const secondTopMoveSan = secondTopLine?.moves.at(0)?.san;

    const secondTopMove = secondTopMoveSan
        ? safeMove(node.state.fen, secondTopMoveSan)
        : undefined;

    const secondSubjectiveEvaluation = secondTopLine?.evaluation
        && secondTopMove
        && getSubjectiveEvaluation(
            secondTopLine.evaluation,
            adaptPieceColour(secondTopMove.color)
        );

    return {
        secondTopLine,
        secondTopMove,
        secondSubjectiveEvaluation: secondSubjectiveEvaluation || undefined
    };
}

export function extractPreviousStateTreeNode(
    node: StateTreeNode
): ExtractedPreviousNode | null {
    // Get top engine line and move in this position
    const topLine = getTopEngineLine(node.state.engineLines);
    if (!topLine) return null;

    const topMoveSan = topLine.moves.at(0)?.san;
    if (!topMoveSan) return null;

    const topMove = safeMove(node.state.fen, topMoveSan);
    if (!topMove) return null;

    // Get played move in this position
    const playedMove = node.parent
        && node.state.move
        && safeMove(node.parent.state.fen, node.state.move.san);

    const subjectiveEvaluation = getSubjectiveEvaluation(
        topLine.evaluation,
        adaptPieceColour(playedMove?.color || WHITE)
    );

    return {
        board: new Chess(node.state.fen),
        state: node.state,
        topLine: topLine,
        topMove: topMove,
        ...extractSecondTopMove(node, topLine),
        evaluation: topLine.evaluation,
        subjectiveEvaluation: subjectiveEvaluation,
        playedMove: playedMove || undefined
    };
}

/**
 * @description Extract analysis information from a node. Returns an object
 * of extracted data, or null if any required pieces of data are missing.
 */
export function extractCurrentStateTreeNode(
    node: StateTreeNode
): ExtractedCurrentNode | null {
    if (!node.parent) return null;

    // Get top engine line and move in this position
    const topLine = getTopEngineLine(node.state.engineLines);
    if (!topLine) return null;

    const topMoveSan = topLine.moves.at(0)?.san;

    const topMove = topMoveSan
        ? safeMove(node.state.fen, topMoveSan)
        : undefined;

    // Get played move in this position
    const playedMoveSan = node.state.move?.san;
    if (!playedMoveSan) return null;

    const playedMove = safeMove(node.parent.state.fen, playedMoveSan);
    if (!playedMove) return null;

    const subjectiveEvaluation = getSubjectiveEvaluation(
        topLine.evaluation,
        adaptPieceColour(playedMove.color)
    );

    return {
        board: new Chess(node.state.fen),
        state: node.state,
        topLine: topLine,
        topMove: topMove,
        ...extractSecondTopMove(node, topLine),
        evaluation: topLine.evaluation,
        subjectiveEvaluation: subjectiveEvaluation,
        playedMove: playedMove
    };
}
