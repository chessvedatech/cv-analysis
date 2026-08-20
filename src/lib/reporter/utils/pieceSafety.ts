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

import { Chess, Move, PAWN, KNIGHT, ROOK, KING } from "chess.js";
import { minBy } from "lodash";

import { BoardPiece, getBoardPieces, toBoardPiece } from "../types/BoardPiece";
import PieceColour, { adaptPieceColour } from "@/constants/PieceColour";
import { pieceValues } from "@/constants/utils";
import { getAttackingMoves } from "./attackers";
import { getDefendingMoves } from "./defenders";

export function isPieceSafe(
    board: Chess,
    piece: BoardPiece,
    playedMove?: Move
) {
    const directAttackers = getAttackingMoves(board, piece, false)
        .map(toBoardPiece);

    const attackers = getAttackingMoves(board, piece).map(toBoardPiece);
    const defenders = getDefendingMoves(board, piece).map(toBoardPiece);

    // Favourable, decimal sacrifices (rook for 2 pieces etc.) are safe
    if (
        playedMove?.captured
        && piece.type == ROOK
        && pieceValues[playedMove.captured] == pieceValues[KNIGHT]
        && attackers.length == 1
        && defenders.length > 0
        && pieceValues[attackers[0].type] == pieceValues[KNIGHT]
    ) return true;

    // A piece with a direct attacker of lower value than itself isn't safe
    const hasLowerValueAttacker = directAttackers.some(attacker => (
        pieceValues[attacker.type] < pieceValues[piece.type]
    ));

    if (hasLowerValueAttacker) return false;

    // A piece that does not have more attackers than it has defenders is safe
    if (attackers.length <= defenders.length) {
        return true;
    }

    // A piece lower in value than any direct attacker, and with any
    // defender lower in value than all direct attackers, must be safe
    const lowestValueAttacker = minBy(directAttackers,
        attacker => pieceValues[attacker.type]
    );

    if (!lowestValueAttacker) return true;

    if (
        pieceValues[piece.type] < pieceValues[lowestValueAttacker.type]
        && defenders.some(defender => (
            pieceValues[defender.type] < pieceValues[lowestValueAttacker.type]
        ))
    ) return true;

    // A piece defended by any pawn, at this point, must be safe
    if (defenders.some(defender => defender.type == PAWN)) {
        return true;
    }

    return false;
}

export function getUnsafePieces(
    board: Chess,
    colour: PieceColour,
    playedMove?: Move
) {
    const capturedPieceValue = playedMove?.captured
        ? pieceValues[playedMove.captured] : 0;

    return getBoardPieces(board).filter(piece => (
        piece?.color == adaptPieceColour(colour)
        && piece.type != PAWN
        && piece.type != KING
        && pieceValues[piece.type] > capturedPieceValue
        && !isPieceSafe(board, piece, playedMove)
    ));
}
