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

type Level = "debug" | "info" | "warn" | "error";

const order: Record<Level, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
};

const threshold = order[
    (process.env.LOG_LEVEL as Level) in order
        ? process.env.LOG_LEVEL as Level
        : "info"
];

function emit(level: Level, args: unknown[]) {
    if (order[level] < threshold) return;

    const prefix = `[cv-analysis] ${new Date().toISOString()} ${level}:`;
    const write = level === "error" || level === "warn"
        ? console.error
        : console.log;

    write(prefix, ...args);
}

const logger = {
    debug: (...args: unknown[]) => emit("debug", args),
    info: (...args: unknown[]) => emit("info", args),
    warn: (...args: unknown[]) => emit("warn", args),
    error: (...args: unknown[]) => emit("error", args)
};

export default logger;
