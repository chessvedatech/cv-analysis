/*
 * cv-analysis — Chessveda's chess analysis service
 * Copyright (C) 2026 Midas 24x7 Games Private Limited
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

/**
 * Identifies which engine produced a set of lines. Chessveda runs Stockfish
 * server-side as a native binary, so that is the only source this service
 * emits — the enum exists because `EngineLine.source` is part of the
 * WintrChess-derived line format.
 */
export enum EngineVersion {
    STOCKFISH_NATIVE = "stockfish-native"
}

export default EngineVersion;
