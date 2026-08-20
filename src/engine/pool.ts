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

import config from "@/config";
import logger from "@/lib/utils/logger";
import { StockfishEngine } from "./stockfish";

/**
 * A fixed pool of long-lived Stockfish processes.
 *
 * Spawning an engine per position costs ~100ms of process startup and throws
 * away the transposition table each time, so engines are reused. The pool size
 * is the real bound on how many searches can burn CPU at once — a whole-game
 * review acquires and releases per position rather than holding an engine for
 * its entire run, so several concurrent reviews interleave fairly instead of
 * one starving the others.
 */
class EnginePool {
    private idle: StockfishEngine[] = [];
    private created = 0;
    private waiters: Array<(engine: StockfishEngine) => void> = [];

    private get size() {
        return Math.max(1, config.limits.maxConcurrentSearches);
    }

    async acquire(): Promise<StockfishEngine> {
        const pooled = this.idle.pop();

        if (pooled) {
            // A process can die while sitting idle (OOM killer, crash). Drop
            // it and fall through to creating a replacement.
            if (pooled.alive) return pooled;

            this.created--;
            pooled.destroy();
        }

        if (this.created < this.size) {
            this.created++;

            const engine = new StockfishEngine();

            try {
                await engine.start();
                return engine;
            } catch (error) {
                this.created--;
                engine.destroy();
                throw error;
            }
        }

        return new Promise<StockfishEngine>(resolve => {
            this.waiters.push(resolve);
        });
    }

    release(engine: StockfishEngine) {
        if (!engine.alive) {
            this.created--;
            engine.destroy();

            // A waiter handed a dead engine would fail immediately, so wake it
            // through acquire() instead, which will spawn a replacement.
            const waiter = this.waiters.shift();
            if (waiter) {
                this.acquire().then(waiter).catch(error => {
                    logger.error("failed to replace dead engine", error);
                    this.waiters.unshift(waiter);
                });
            }

            return;
        }

        const waiter = this.waiters.shift();

        if (waiter) {
            waiter(engine);
        } else {
            this.idle.push(engine);
        }
    }

    /** Runs `fn` with an engine checked out of the pool. */
    async withEngine<T>(fn: (engine: StockfishEngine) => Promise<T>): Promise<T> {
        const engine = await this.acquire();

        try {
            return await fn(engine);
        } finally {
            this.release(engine);
        }
    }

    async drain() {
        for (const engine of this.idle) engine.destroy();
        this.idle = [];
        this.created = 0;
    }
}

export const enginePool = new EnginePool();

export default enginePool;
