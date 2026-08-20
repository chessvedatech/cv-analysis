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

import { Color, WHITE, BLACK } from "chess.js";

export enum PieceColour {
    WHITE = "white",
    BLACK = "black"
}

export function adaptPieceColour(colour: PieceColour): Color;
export function adaptPieceColour(colour: Color): PieceColour;

export function adaptPieceColour(colour: PieceColour | Color) {
    switch (colour) {
        case WHITE:
            return PieceColour.WHITE;
        case BLACK:
            return PieceColour.BLACK;
        case PieceColour.WHITE:
            return WHITE;
        case PieceColour.BLACK:
            return BLACK;
    }
}

export function flipPieceColour(color: Color): Color;
export function flipPieceColour(color: PieceColour): PieceColour;

export function flipPieceColour(colour: PieceColour | Color) {
    switch (colour) {
        case PieceColour.WHITE:
            return PieceColour.BLACK;
        case PieceColour.BLACK:
            return PieceColour.WHITE;
        case WHITE:
            return BLACK;
        case BLACK:
            return WHITE;
    }
}

export default PieceColour;
