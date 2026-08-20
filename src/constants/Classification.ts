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

export enum Classification {
    BRILLIANT = "brilliant",
    CRITICAL = "critical",
    BEST = "best",
    EXCELLENT = "excellent",
    OKAY = "okay",
    INACCURACY = "inaccuracy",
    MISTAKE = "mistake",
    BLUNDER = "blunder",
    THEORY = "theory",
    FORCED = "forced",
    RISKY = "risky"
}

export const classifValues: Record<Classification, number> = {
    [Classification.BLUNDER]: 0,
    [Classification.MISTAKE]: 1,
    [Classification.INACCURACY]: 2,
    [Classification.RISKY]: 2,
    [Classification.OKAY]: 3,
    [Classification.EXCELLENT]: 4,
    [Classification.BEST]: 5,
    [Classification.CRITICAL]: 5,
    [Classification.BRILLIANT]: 5,
    [Classification.FORCED]: 5,
    [Classification.THEORY]: 5
};

// https://en.wikipedia.org/wiki/Portable_Game_Notation#Standard_NAGs
export const classifNags: Record<string, string | undefined> = {
    [Classification.BRILLIANT]: "$3",
    [Classification.CRITICAL]: "$1",
    [Classification.INACCURACY]: "$6",
    [Classification.MISTAKE]: "$2",
    [Classification.BLUNDER]: "$4",
    [Classification.RISKY]: "$5"
};

export default Classification;
