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

import { ErrorRequestHandler, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

import logger from "@/lib/utils/logger";

/** Lets async route handlers reject without taking the process down. */
export const asyncHandler = (
    handler: RequestHandler
): RequestHandler => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

export const notFound: RequestHandler = (_req, res) => {
    res.status(StatusCodes.NOT_FOUND).json({ error: "not found" });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const status: number = error?.statusCode
        ?? StatusCodes.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
        logger.error("request failed", error);
    } else {
        logger.warn("request rejected", error?.message);
    }

    res.status(status).json({
        error: error?.message || "internal server error"
    });
};
