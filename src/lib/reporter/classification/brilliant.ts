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
    ExtractedPreviousNode,
    ExtractedCurrentNode
} from "../types/ExtractedNode";
import { adaptPieceColour } from "@/constants/PieceColour";
import { isMoveCriticalCandidate } from "../utils/criticalMove";
import { getUnsafePieces } from "../utils/pieceSafety";
import { hasDangerLevels } from "../utils/dangerLevels";
import { isPieceTrapped } from "../utils/pieceTrapped";
import { getAttackingMoves } from "../utils/attackers";

/**
 * @description Consider brilliant classification based on a
 * state. Returns whether brilliant is recommended
 */
export function considerBrilliantClassification(
    previous: ExtractedPreviousNode,
    current: ExtractedCurrentNode
) {
    if (!isMoveCriticalCandidate(previous, current)) return false;

    // Promotions cannot be brilliant
    if (current.playedMove.promotion) return false;

    const previousUnsafePieces = getUnsafePieces(
        previous.board,
        adaptPieceColour(current.playedMove.color)
    );

    const unsafePieces = getUnsafePieces(
        current.board,
        adaptPieceColour(current.playedMove.color),
        current.playedMove
    );

    // Moving a piece to safety (less unsafe pieces than in previous position)
    // disallows a brilliant
    if (
        !current.board.isCheck()
        && unsafePieces.length < previousUnsafePieces.length
    ) return false;

    // Detect equal or greater counterthreats when unsafe piece is taken
    const dangerLevelsProtected = unsafePieces.every(
        unsafePiece => hasDangerLevels(
            current.board,
            unsafePiece,
            getAttackingMoves(current.board, unsafePiece, false)
        )
    );

    if (dangerLevelsProtected) return false;

    const previousTrappedPieces = previousUnsafePieces.filter(
        unsafePiece => isPieceTrapped(previous.board, unsafePiece)
    );

    const trappedPieces = unsafePieces.filter(
        unsafePiece => isPieceTrapped(current.board, unsafePiece)
    );

    const movedPieceTrapped = previousTrappedPieces.some(
        trappedPiece => trappedPiece.square == current.playedMove.from
    );

    if (
        trappedPieces.length == unsafePieces.length
        || movedPieceTrapped
        || trappedPieces.length < previousTrappedPieces.length
    ) return false;

    return unsafePieces.length > 0;
}
