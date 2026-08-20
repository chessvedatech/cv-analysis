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

/**
 * Counting semaphore used to bound how many whole-game reviews run at once.
 * Requests beyond the limit queue rather than fail, so a burst of players
 * hitting "Analyse" at the same time is slow instead of fatal.
 */
export class Semaphore {
    private active = 0;
    private queue: Array<() => void> = [];

    constructor(private readonly limit: number) {}

    get pending() {
        return this.queue.length;
    }

    get inFlight() {
        return this.active;
    }

    private async acquire() {
        if (this.active < this.limit) {
            this.active++;
            return;
        }

        await new Promise<void>(resolve => this.queue.push(resolve));
        this.active++;
    }

    private release() {
        this.active--;
        this.queue.shift()?.();
    }

    async run<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();

        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}

export default Semaphore;
