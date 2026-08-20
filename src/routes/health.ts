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

import config from "@/config";
import { reviewQueueStats } from "@/services/review.services";

const router = Router();

/**
 * GET /health — unauthenticated so a load balancer can reach it.
 */
router.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "cv-analysis",
        engine: {
            path: config.engine.path,
            defaultDepth: config.search.defaultDepth,
            maxDepth: config.search.maxDepth
        },
        queue: reviewQueueStats(),
        uptimeSeconds: Math.round(process.uptime())
    });
});

export default router;
