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

import morgan from "morgan";
import { Request, RequestHandler, Response } from "express";

import config from "@/config";
import logger from "@/lib/utils/logger";

/**
 * HTTP access logging.
 *
 * A review holds its request open for as long as the engine takes — seconds
 * for a short game, minutes for a long one. Logging only on completion would
 * leave nothing on screen while that runs, so each request is logged twice:
 * once on arrival, once when it finishes with its status and duration. That
 * makes "did my request even reach the service?" answerable at a glance, which
 * is the question this exists to settle.
 *
 * Nothing here logs headers or bodies. `x-analysis-key` is the shared secret
 * and must never reach the log; any format string added below has to keep
 * that true.
 */

const stream = {
    write: (message: string) => logger.info(message.trimEnd())
};

/**
 * Health checks are the load balancer talking to itself. They are worth seeing
 * in development, where they confirm the service is reachable, and are pure
 * noise in production, where they arrive every few seconds forever.
 */
const skipHealthInProduction = (req: Request) =>
    config.nodeEnv === "production" && req.url.startsWith("/health");

const arrival = morgan<Request, Response>("--> :method :url", {
    immediate: true,
    skip: skipHealthInProduction,
    stream
});

const completion = morgan<Request, Response>(
    "<-- :method :url :status :res[content-length]b :response-time ms",
    {
        skip: skipHealthInProduction,
        stream
    }
);

const httpLogger: RequestHandler[] = [arrival, completion];

export default httpLogger;
