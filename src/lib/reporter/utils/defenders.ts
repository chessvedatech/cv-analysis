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

import { Chess } from "chess.js";
import { minBy } from "lodash";

import { BoardPiece } from "../types/BoardPiece";
import { adaptPieceColour, flipPieceColour } from "@/constants/PieceColour";
import { setFenTurn } from "@/lib/utils/chess";
import { getAttackingMoves } from "./attackers";

export function getDefendingMoves(
    board: Chess,
    piece: BoardPiece,
    transitive: boolean = true
) {
    const defenderBoard = new Chess(board.fen());

    const attackingMoves = getAttackingMoves(defenderBoard, piece, false);

    // Where there are attackers, simulate taking the piece with each attacker
    // and record the minima of recaptures
    const smallestRecapturerSet = minBy(
        attackingMoves.map(attackingMove => {
            const captureBoard = new Chess(
                setFenTurn(
                    defenderBoard.fen(),
                    adaptPieceColour(flipPieceColour(piece.color))
                )
            );

            try {
                captureBoard.move(attackingMove);
            } catch {
                return;
            }

            return getAttackingMoves(
                captureBoard,
                {
                    type: attackingMove.piece,
                    color: attackingMove.color,
                    square: attackingMove.to
                },
                transitive
            );
        }).filter(recapturers => !!recapturers),
        recapturers => recapturers.length
    );

    // Where there are no attackers, flip the colour of the piece and count
    // the attackers of the flipped piece
    if (!smallestRecapturerSet) {
        const flippedPiece: BoardPiece = {
            type: piece.type,
            color: flipPieceColour(piece.color),
            square: piece.square
        };

        defenderBoard.put(flippedPiece, piece.square);

        return getAttackingMoves(defenderBoard, flippedPiece, transitive);
    }

    return smallestRecapturerSet;
}
