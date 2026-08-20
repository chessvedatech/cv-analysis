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

import { Router } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";

import { asyncHandler } from "@/middleware/error";
import { analysePosition } from "@/services/position.services";

const router = Router();

const positionSchema = z.object({
    fen: z.string().min(1).max(120),
    depth: z.number().int().optional(),
    multiPv: z.number().int().optional()
});

/**
 * POST /position
 *
 * Evaluates one position and returns its top engine lines.
 */
router.post("/position", asyncHandler(async (req, res) => {
    const parsed = positionSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(StatusCodes.BAD_REQUEST).json({
            error: "invalid position request",
            issues: parsed.error.issues.map(issue => ({
                path: issue.path.join("."),
                message: issue.message
            }))
        });
        return;
    }

    res.json(await analysePosition(parsed.data));
}));

export default router;
