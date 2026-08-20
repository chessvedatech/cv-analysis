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

import { Chess, Square, PieceSymbol, KING } from "chess.js";
import { isEqual, xorWith } from "lodash";

import { BoardPiece } from "../types/BoardPiece";
import { RawMove, toRawMove } from "../types/RawMove";
import { adaptPieceColour, flipPieceColour } from "@/constants/PieceColour";
import { setFenTurn, getCaptureSquare } from "@/lib/utils/chess";

interface TransitiveAttacker {
    directFen: string;
    square: Square;
    type: PieceSymbol;
}

function directAttackingMoves(
    board: Chess,
    piece: BoardPiece
): RawMove[] {
    // Set turn to attacker's side (opposite of piece)
    const attackerBoard = new Chess(
        setFenTurn(
            board.fen(),
            adaptPieceColour(flipPieceColour(piece.color))
        )
    );

    const attackingMoves: RawMove[] = attackerBoard
        .moves({ verbose: true })
        .filter(move => getCaptureSquare(move) == piece.square)
        .map(toRawMove);

    const kingAttackerSquare = attackerBoard
        .attackers(piece.square)
        .find(attackerSquare => (
            attackerBoard.get(attackerSquare)?.type == KING
        ));

    if (
        kingAttackerSquare
        && !attackingMoves.some(attack => attack.piece == KING)
    ) {
        attackingMoves.push({
            piece: KING,
            color: flipPieceColour(piece.color),
            from: kingAttackerSquare,
            to: piece.square
        });
    }

    return attackingMoves;
}

export function getAttackingMoves(
    board: Chess,
    piece: BoardPiece,
    transitive: boolean = true
): RawMove[] {
    const attackingMoves = directAttackingMoves(board, piece);

    if (!transitive) return attackingMoves;

    // Keep a record of each transitive attacker and the FEN on
    // which they are considered a direct attacker
    const frontier: TransitiveAttacker[] = attackingMoves.map(
        attackingMove => ({
            directFen: board.fen(),
            square: attackingMove.from,
            type: attackingMove.piece
        })
    );

    while (frontier.length > 0) {
        const transitiveAttacker = frontier.pop();
        if (!transitiveAttacker) break;

        const transitiveBoard = new Chess(transitiveAttacker.directFen);

        // A king cannot be at the front of a battery
        if (transitiveAttacker.type == KING) {
            continue;
        }

        // Remove the piece at the front of the battery
        const oldAttackingMoves = directAttackingMoves(transitiveBoard, piece);

        transitiveBoard.remove(transitiveAttacker.square);

        // Find revealed attackers as a XOR between old (removed piece excluded)
        // and new direct attackers list
        const revealedAttackingMoves = xorWith(
            oldAttackingMoves.filter(
                attackingMove => attackingMove.from != transitiveAttacker.square
            ),
            directAttackingMoves(transitiveBoard, piece),
            isEqual
        );

        // Record revealed attackers in final list
        attackingMoves.push(...revealedAttackingMoves);

        // Queue revealed attackers for further recursion
        frontier.push(
            ...revealedAttackingMoves.map(attackingMove => ({
                directFen: transitiveBoard.fen(),
                square: attackingMove.from,
                type: attackingMove.piece
            }))
        );
    }

    return attackingMoves;
}
