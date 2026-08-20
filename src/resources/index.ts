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

import fs from "fs";
import path from "path";

/**
 * Resources are read from disk rather than `import`ed so a 370KB JSON literal
 * never enters the type checker. `__dirname` is `src/resources` under
 * esbuild-register in development and `dist/resources` in production — the
 * build step copies this directory verbatim, so the same join works in both.
 */
function readResource<T>(filename: string): T {
    return JSON.parse(
        fs.readFileSync(path.join(__dirname, filename), "utf8")
    ) as T;
}

/**
 * Opening book keyed by the piece-placement field of a FEN (the part before
 * the first space). Derived from WintrChess, GPL-3.0.
 */
export const openings = readResource<Record<string, string>>("openings.json");
