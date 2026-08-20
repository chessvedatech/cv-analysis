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

import { z } from "zod";
import { maxBy } from "lodash";

import EngineVersion from "@/constants/EngineVersion";
import { evaluationSchema } from "./Evaluation";
import { moveSchema } from "./Move";

export const engineLineSchema = z.object({
    evaluation: evaluationSchema,
    source: z.enum(EngineVersion),
    depth: z.number(),
    index: z.number(),
    moves: z.array(moveSchema)
});

export type EngineLine = z.infer<typeof engineLineSchema>;

/**
 * @description Finds an engine line in a list of lines that is the same
 * as the reference line but has a specified index.
 */
export function getLineGroupSibling(
    lines: EngineLine[],
    referenceLine: EngineLine,
    index: number
) {
    return lines.find(line => (
        line.depth == referenceLine.depth
        && line.source == referenceLine.source
        && line.index == index
    ));
}

/**
 * @description Returns the line with the highest depth and lowest index.
 */
export function getTopEngineLine(lines: EngineLine[]) {
    return maxBy(lines, line => line.depth - line.index);
}
