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

import { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import crypto from "crypto";

import config from "@/config";
import logger from "@/lib/utils/logger";

/**
 * The service is not internet-facing: the Chessveda backend is its only
 * client, and it proves that with a shared secret. Refusing to start without
 * one in production is deliberate — a silently unauthenticated analysis box
 * is free CPU for anyone who finds it.
 */
export function assertServiceKeyConfigured() {
    if (config.serviceKey) return;

    if (config.nodeEnv === "production") {
        throw new Error(
            "ANALYSIS_SERVICE_KEY must be set when NODE_ENV=production"
        );
    }

    logger.warn(
        "ANALYSIS_SERVICE_KEY is empty — requests are unauthenticated. "
        + "This is only acceptable in local development."
    );
}

/** Constant-time compare so the key cannot be recovered byte by byte. */
function matches(presented: string) {
    const expected = Buffer.from(config.serviceKey);
    const actual = Buffer.from(presented);

    if (expected.length !== actual.length) return false;

    return crypto.timingSafeEqual(expected, actual);
}

const authenticate: RequestHandler = (req, res, next) => {
    if (!config.serviceKey) return next();

    const presented = req.header("x-analysis-key");

    if (!presented || !matches(presented)) {
        res.sendStatus(StatusCodes.UNAUTHORIZED);
        return;
    }

    next();
};

export default authenticate;
