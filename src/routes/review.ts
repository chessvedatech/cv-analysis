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

import config from "@/config";
import { asyncHandler } from "@/middleware/error";
import { reviewGame } from "@/services/review.services";

const router = Router();

const reviewSchema = z.object({
    gameId: z.string().min(1).max(128),
    moves: z.array(z.object({
        san: z.string().min(1).max(10),
        from: z.string().optional(),
        to: z.string().optional()
    })).min(1).max(config.limits.maxMoves),
    initialFen: z.string().optional(),
    depth: z.number().int().optional(),
    multiPv: z.number().int().optional(),
    includeBrilliant: z.boolean().optional(),
    includeCritical: z.boolean().optional(),
    includeTheory: z.boolean().optional(),
    includeStateTree: z.boolean().optional()
});

/**
 * POST /review
 *
 * Evaluates every position of a game with Stockfish, classifies each move,
 * and returns the flattened report the Chessveda clients render.
 */
router.post("/review", asyncHandler(async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(StatusCodes.BAD_REQUEST).json({
            error: "invalid review request",
            issues: parsed.error.issues.map(issue => ({
                path: issue.path.join("."),
                message: issue.message
            }))
        });
        return;
    }

    res.json(await reviewGame(parsed.data));
}));

export default router;
