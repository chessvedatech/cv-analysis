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
import dotenv from "dotenv";

/**
 * Environment is chosen by NODE_ENV, which the npm scripts set before this
 * module loads: `npm run dev` uses .env.development, `npm start` uses
 * .env.production.
 *
 * NODE_ENV cannot come from the env file itself — it decides which file to
 * read, so it has to be set first. dotenv never overwrites a variable that is
 * already set, so anything the process was started with (a container's
 * --env-file, a systemd Environment= line) still wins over the file.
 */
const envFile =
    process.env.NODE_ENV === "production"
        ? ".env.production"
        : ".env.development";

const envPath = path.resolve(process.cwd(), envFile);

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    // Not fatal: a container or service manager may supply the variables
    // directly, which is the norm in production. Missing *and* unset is
    // caught later by the checks on the values themselves.
    console.warn(
        `[cv-analysis] ${envFile} not found at ${envPath}; `
        + "relying on variables already present in the environment."
    );
}

function int(name: string, fallback: number) {
    const parsed = parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function list(name: string) {
    return (process.env[name] ?? "")
        .split(",")
        .map(entry => entry.trim())
        .filter(Boolean);
}

const config = {
    port: int("PORT", 8090),
    nodeEnv: process.env.NODE_ENV ?? "development",

    /**
     * Shared secret the Chessveda backend presents as `x-analysis-key`. Empty
     * disables the check, which is only ever appropriate locally — see
     * middleware/auth.ts, which refuses to start unauthenticated in
     * production.
     */
    serviceKey: process.env.ANALYSIS_SERVICE_KEY ?? "",
    corsOrigins: list("CORS_ORIGINS"),

    engine: {
        path: process.env.STOCKFISH_PATH ?? "stockfish",
        threads: int("ENGINE_THREADS", 1),
        hashMb: int("ENGINE_HASH_MB", 64),
        /** Wall-clock cap for one position search. */
        movetimeMs: int("MOVETIME_MS", 3000),
        initTimeoutMs: int("ENGINE_INIT_TIMEOUT_MS", 10000)
    },

    search: {
        defaultDepth: int("DEFAULT_DEPTH", 16),
        minDepth: int("MIN_DEPTH", 6),
        maxDepth: int("MAX_DEPTH", 25),
        /**
         * The classifier needs the second-best line to decide `critical` and
         * `brilliant`, so MultiPV never drops below 2.
         */
        defaultMultiPv: int("DEFAULT_MULTIPV", 2),
        maxMultiPv: int("MAX_MULTIPV", 5)
    },

    limits: {
        maxConcurrentReviews: int("MAX_CONCURRENT_REVIEWS", 2),
        maxConcurrentSearches: int("MAX_CONCURRENT_SEARCHES", 2),
        reviewTimeoutMs: int("REVIEW_TIMEOUT_MS", 600000),
        maxMoves: int("MAX_MOVES", 400)
    }
};

export default config;
