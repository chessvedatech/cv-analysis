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

import { spawn, ChildProcess } from "child_process";
import os from "os";
import { Chess } from "chess.js";

import config from "@/config";
import logger from "@/lib/utils/logger";
import EngineVersion from "@/constants/EngineVersion";
import { EngineLine } from "@/types/EngineLine";
import Evaluation from "@/types/Evaluation";
import Move from "@/types/Move";

export interface EvaluateOptions {
    depth: number;
    multiPv: number;
    /** Wall-clock cap for this search; defaults to config.engine.movetimeMs. */
    movetimeMs?: number;
}

/** One `info` line parsed out of Stockfish's UCI output. */
interface ParsedInfo {
    depth: number;
    multipv: number;
    evaluation: Evaluation;
    pv: string[];
}

const INFO_PATTERN = /^info .*\bdepth (\d+)\b/;

/**
 * Converts a UCI principal variation into the {san, uci} pairs the classifier
 * expects. Stops at the first move chess.js rejects — a truncated PV is still
 * usable because only the first move drives classification.
 */
function toMoves(fen: string, pv: string[]): Move[] {
    const board = new Chess(fen);
    const moves: Move[] = [];

    for (const uci of pv) {
        try {
            const move = board.move({
                from: uci.slice(0, 2),
                to: uci.slice(2, 4),
                promotion: uci.charAt(4) || undefined
            });

            moves.push({ san: move.san, uci: move.lan });
        } catch {
            break;
        }
    }

    return moves;
}

/**
 * Parses one `info` line. Returns null for lines without a score (bounds-only
 * lines, `currmove` progress lines, etc.).
 *
 * UCI scores are reported from the perspective of the side to move, but every
 * Evaluation in the reporter is white-relative, so the sign is flipped here
 * once — for black to move — rather than at each of the reporter's call sites.
 */
function parseInfo(line: string, whiteToMove: boolean): ParsedInfo | null {
    const depthMatch = line.match(INFO_PATTERN);
    if (!depthMatch) return null;

    // Lower/upperbound scores are provisional and can be wildly off; the
    // search always follows them with an exact line at the same depth.
    if (line.includes("lowerbound") || line.includes("upperbound")) return null;

    const perspective = whiteToMove ? 1 : -1;

    const cpMatch = line.match(/\bscore cp (-?\d+)/);
    const mateMatch = line.match(/\bscore mate (-?\d+)/);

    let evaluation: Evaluation;

    if (cpMatch) {
        evaluation = {
            type: "centipawn",
            value: parseInt(cpMatch[1], 10) * perspective
        };
    } else if (mateMatch) {
        evaluation = {
            type: "mate",
            value: parseInt(mateMatch[1], 10) * perspective
        };
    } else {
        return null;
    }

    const multipvMatch = line.match(/\bmultipv (\d+)/);
    const pvMatch = line.match(/\bpv (.+)$/);

    return {
        depth: parseInt(depthMatch[1], 10),
        multipv: multipvMatch ? parseInt(multipvMatch[1], 10) : 1,
        evaluation,
        pv: pvMatch ? pvMatch[1].trim().split(/\s+/) : []
    };
}

/**
 * A single long-lived Stockfish process driven over UCI. Instances are owned
 * by the pool in engine/pool.ts and are never shared between concurrent
 * searches — one `go` at a time per process.
 */
export class StockfishEngine {
    private process: ChildProcess | null = null;
    private buffer = "";
    private listeners = new Set<(line: string) => void>();
    private ready = false;

    get alive() {
        return (
            !!this.process
            && !this.process.killed
            && this.process.exitCode === null
            && !!this.process.stdin?.writable
        );
    }

    /**
     * Writes a UCI command only while the process is actually alive and
     * writable. Writing to a pipe whose process already died can emit an
     * unhandled "error" that takes down the whole service, so every write
     * goes through here.
     */
    private write(command: string): boolean {
        if (!this.alive) return false;

        try {
            this.process!.stdin!.write(command.endsWith("\n")
                ? command
                : command + "\n");
            return true;
        } catch (error) {
            logger.error("stockfish stdin write failed", error);
            return false;
        }
    }

    private onData(chunk: Buffer) {
        this.buffer += chunk.toString();

        const lines = this.buffer.split("\n");
        // The trailing element is whatever arrived after the last newline —
        // an incomplete line that must wait for the next chunk.
        this.buffer = lines.pop() ?? "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            for (const listener of [...this.listeners]) {
                listener(trimmed);
            }
        }
    }

    async start(): Promise<void> {
        if (this.ready) return;

        await new Promise<void>((resolve, reject) => {
            let settled = false;
            let timer: NodeJS.Timeout | null = null;

            const settle = (fn: () => void) => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                fn();
            };

            try {
                this.process = spawn(config.engine.path);
            } catch (error) {
                return reject(error);
            }

            if (!this.process.stdout || !this.process.stdin) {
                return reject(new Error("failed to open stockfish pipes"));
            }

            // Best-effort: lets the kernel favour the event loop over the
            // search under CPU contention. Must never block startup.
            if (this.process.pid) {
                try {
                    os.setPriority(this.process.pid, 10);
                } catch {
                    // Not permitted on every platform; harmless either way.
                }
            }

            this.process.on("error", error => {
                logger.error("stockfish process error", error);
                this.ready = false;
                settle(() => reject(error));
            });

            this.process.on("exit", code => {
                this.ready = false;
                if (code !== 0) logger.warn(`stockfish exited (code ${code})`);
            });

            this.process.stdin.on("error", error => {
                logger.error("stockfish stdin error", error);
            });

            this.process.stderr?.on("data", data => {
                logger.error("stockfish stderr", data.toString().trim());
            });

            this.process.stdout.on("data", chunk => this.onData(chunk));

            const onReady = (line: string) => {
                if (line !== "readyok") return;
                this.listeners.delete(onReady);
                this.ready = true;
                settle(resolve);
            };

            this.listeners.add(onReady);

            this.write("uci");
            this.write("setoption name UCI_AnalyseMode value true");
            this.write(`setoption name Threads value ${config.engine.threads}`);
            this.write(`setoption name Hash value ${config.engine.hashMb}`);
            this.write("isready");

            timer = setTimeout(() => {
                // Nothing else holds a handle to this process once we stop
                // waiting; without the kill it lingers as an orphan burning
                // the CPU that made startup slow in the first place.
                this.listeners.delete(onReady);
                this.process?.kill();
                settle(() => reject(new Error("stockfish init timed out")));
            }, config.engine.initTimeoutMs);
        });
    }

    /**
     * Runs one search and returns the deepest complete set of engine lines.
     * Rejects only when the engine is unusable — a search that times out
     * still resolves with whatever depth it reached.
     */
    async evaluate(fen: string, options: EvaluateOptions): Promise<EngineLine[]> {
        if (!this.ready || !this.alive) {
            throw new Error("engine is not running");
        }

        const board = new Chess(fen);
        const whiteToMove = board.turn() === "w";
        const movetime = options.movetimeMs ?? config.engine.movetimeMs;

        // Asking for more lines than there are legal moves makes Stockfish
        // report fewer PVs than requested, which would look like a truncated
        // search to the caller.
        const legalMoveCount = board.moves().length;
        const multiPv = Math.max(1, Math.min(options.multiPv, legalMoveCount));

        // A finished position has no move to search; `go` would return
        // "bestmove (none)" and hang the multipv bookkeeping.
        if (legalMoveCount === 0) {
            return [{
                // Mate value 0 means "the side to move is mated here"; the
                // reporter resolves which side that favours from the colour
                // of the move that reached the position.
                evaluation: board.isCheckmate()
                    ? { type: "mate", value: 0 }
                    : { type: "centipawn", value: 0 },
                source: EngineVersion.STOCKFISH_NATIVE,
                depth: 0,
                index: 1,
                moves: []
            }];
        }

        return new Promise<EngineLine[]>((resolve, reject) => {
            // Keyed by multipv index; each entry holds the deepest info line
            // seen for that index so far.
            const best = new Map<number, ParsedInfo>();
            let timer: NodeJS.Timeout | null = null;
            let settled = false;

            const finish = (fn: () => void) => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                this.listeners.delete(listener);
                fn();
            };

            const collect = () => {
                const maxDepth = Math.max(
                    ...[...best.values()].map(info => info.depth)
                );

                // Only lines from the deepest iteration are mutually
                // comparable — mixing depths would let a shallow second line
                // outrank a deep first one in getTopEngineLine.
                return [...best.values()]
                    .filter(info => info.depth === maxDepth)
                    .sort((a, b) => a.multipv - b.multipv)
                    .map<EngineLine>(info => ({
                        evaluation: info.evaluation,
                        source: EngineVersion.STOCKFISH_NATIVE,
                        depth: info.depth,
                        index: info.multipv,
                        moves: toMoves(fen, info.pv)
                    }));
            };

            const listener = (line: string) => {
                if (line.startsWith("bestmove")) {
                    if (best.size === 0) {
                        return finish(() => reject(
                            new Error("engine returned no evaluation")
                        ));
                    }
                    return finish(() => resolve(collect()));
                }

                const info = parseInfo(line, whiteToMove);
                if (!info) return;

                const existing = best.get(info.multipv);
                if (!existing || info.depth >= existing.depth) {
                    best.set(info.multipv, info);
                }
            };

            this.listeners.add(listener);

            const wrote = (
                this.write(`setoption name MultiPV value ${multiPv}`)
                && this.write(`position fen ${fen}`)
                && this.write(`go depth ${options.depth} movetime ${movetime}`)
            );

            if (!wrote) {
                return finish(() => reject(new Error("engine is not writable")));
            }

            // Backstop for a `bestmove` that never arrives. Generous relative
            // to movetime so it only fires when the engine is genuinely wedged.
            timer = setTimeout(() => {
                this.write("stop");

                if (best.size > 0) {
                    finish(() => resolve(collect()));
                } else {
                    finish(() => reject(new Error("engine search timed out")));
                }
            }, movetime + 15000);
        });
    }

    stop() {
        this.write("stop");
    }

    destroy() {
        this.listeners.clear();
        this.ready = false;

        if (!this.process) return;

        this.write("quit");
        this.process.kill();
        this.process = null;
    }
}
