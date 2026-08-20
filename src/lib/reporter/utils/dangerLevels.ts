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

import { Chess, Move, QUEEN } from "chess.js";
import { differenceWith, isEqual } from "lodash";

import { BoardPiece } from "../types/BoardPiece";
import { RawMove } from "../types/RawMove";
import { pieceValues } from "@/constants/utils";
import PieceColour, { adaptPieceColour } from "@/constants/PieceColour";
import { parseSanMove } from "@/lib/utils/chess";
import { getUnsafePieces } from "./pieceSafety";
import { getAttackingMoves } from "./attackers";

/**
 * @description Returns a list of attacking moves of unsafe pieces of a
 * given colour that are higher or equal in value to the threatened piece.
 */
function relativeUnsafePieceAttacks(
    actionBoard: Chess,
    threatenedPiece: BoardPiece,
    colour: PieceColour,
    playedMove?: Move
) {
    return getUnsafePieces(actionBoard, colour, playedMove)
        .filter(unsafePiece => (
            unsafePiece.square != threatenedPiece.square
            && pieceValues[unsafePiece.type] >= pieceValues[threatenedPiece.type]
        ))
        .map(unsafePiece => getAttackingMoves(
            actionBoard, unsafePiece, false
        ))
        .reduce((acc, val) => acc.concat(val), []);
}

/**
 * @description Assuming that a given piece is under threat, act on the threat
 * through a given move. For example, capturing it as the opponent, or moving
 * it to safety. Returns whether playing the move creates a greater
 * counterthreat than that already imposed on the threatened piece.
 */
export function moveCreatesGreaterThreat(
    board: Chess,
    threatenedPiece: BoardPiece,
    actingMove: RawMove
) {
    const actionBoard = new Chess(board.fen());

    // Pieces of the acting colour, >= in value to the threatened piece
    // that are already unsafe even before the acting move is played
    const previousRelativeAttacks = relativeUnsafePieceAttacks(
        actionBoard,
        threatenedPiece,
        adaptPieceColour(actingMove.color)
    );

    let bakedMove: Move;

    try {
        bakedMove = actionBoard.move(actingMove);
    } catch {
        return false;
    }

    // Attacks on unsafe pieces >= in value to threatened piece that
    // now exist after the acting move has been played
    const relativeAttacks = relativeUnsafePieceAttacks(
        actionBoard,
        threatenedPiece,
        adaptPieceColour(actingMove.color),
        bakedMove
    );

    const newRelativeAttacks = differenceWith(
        relativeAttacks, previousRelativeAttacks, isEqual
    );

    if (newRelativeAttacks.length > 0) return true;

    // Lower value piece sacrifice that if taken leads to mate
    const lowValueCheckmatePin = (
        pieceValues[threatenedPiece.type] < pieceValues[QUEEN]
        && actionBoard.moves().some(
            move => parseSanMove(move).checkmate
        )
    );

    return lowValueCheckmatePin;
}

export function moveLeavesGreaterThreat(
    board: Chess,
    threatenedPiece: BoardPiece,
    actingMove: RawMove
) {
    const actionBoard = new Chess(board.fen());

    try {
        actionBoard.move(actingMove);
    } catch {
        return false;
    }

    // Attacks on unsafe pieces >= in value to threatened piece after move
    const relativeAttacks = relativeUnsafePieceAttacks(
        actionBoard,
        threatenedPiece,
        adaptPieceColour(actingMove.color)
    );

    if (relativeAttacks.length > 0) return true;

    // Lower value piece sacrifice that if taken leads to mate
    const lowValueCheckmatePin = (
        pieceValues[threatenedPiece.type] < pieceValues[QUEEN]
        && actionBoard.moves().some(
            move => parseSanMove(move).checkmate
        )
    );

    return lowValueCheckmatePin;
}

/**
 * @description Returns whether all acting moves create a threat larger than
 * that imposed on the threatened piece. Equality strategies are `creates`
 * when relative threats after the move must be a direct result thereof,
 * and `leaves` when it should only check for the existence of them at all.
 */
export function hasDangerLevels(
    board: Chess,
    threatenedPiece: BoardPiece,
    actingMoves: RawMove[],
    equalityStrategy: "creates" | "leaves" = "leaves"
) {
    return actingMoves.every(actingMove => (equalityStrategy == "creates"
        ? moveCreatesGreaterThreat(board, threatenedPiece, actingMove)
        : moveLeavesGreaterThreat(board, threatenedPiece, actingMove)
    ));
}
