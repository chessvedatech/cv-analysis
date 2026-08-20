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

import express from "express";
import cors from "cors";

import config from "@/config";
import logger from "@/lib/utils/logger";
import enginePool from "@/engine/pool";
import routes from "@/routes";
import httpLogger from "@/middleware/httpLogger";
import { assertServiceKeyConfigured } from "@/middleware/auth";
import { errorHandler, notFound } from "@/middleware/error";

function main() {
    assertServiceKeyConfigured();

    const app = express();

    app.disable("x-powered-by");

    if (config.corsOrigins.length > 0) {
        app.use(cors({ origin: config.corsOrigins }));
    }

    // Ahead of the body parser, so a request that is rejected for being
    // oversized still shows up in the log.
    app.use(httpLogger);

    // A long game's move list is a few tens of KB; the ceiling is generous
    // enough for that and small enough to shrug off a junk payload.
    app.use(express.json({ limit: "2mb" }));

    app.use(routes);
    app.use(notFound);
    app.use(errorHandler);

    const server = app.listen(config.port, () => {
        logger.info(
            `cv-analysis listening on :${config.port} (${config.nodeEnv}), `
            + `engine "${config.engine.path}", `
            + `${config.limits.maxConcurrentSearches} concurrent searches`
        );
    });

    const shutdown = (signal: string) => {
        logger.info(`${signal} received, shutting down`);

        server.close(() => {
            // Stockfish processes are children of this one; without an
            // explicit kill they outlive a container stop and keep burning CPU.
            enginePool.drain().finally(() => process.exit(0));
        });

        setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
