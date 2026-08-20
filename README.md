# cv-analysis

Chessveda's game-analysis microservice. It runs Stockfish server-side, then
classifies every move with the WintrChess reporter and returns a flat report
the web and mobile clients render directly.

> **Licence:** GPL-3.0-or-later. This service contains substantial portions of
> [WintrChess](https://github.com/WintrCat/wintrchess), which is GPL-3.0, so
> this service is GPL-3.0 too. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

## Why it is a separate service

The Chessveda backend used to spawn Stockfish in-process. A whole-game review
is minutes of pegged CPU, and it competed with the event loop that serves
sockets and HTTP. Splitting it out means the engine can be scaled, throttled
and restarted on its own, and the backend keeps owning auth, entitlements,
quota and caching.

## Architecture

```
frontend ──► backend (auth, entitlements, quota, Redis cache) ──► cv-analysis
                                                                      │
                                                              Stockfish pool
```

The backend is the only client. cv-analysis has no database, no sessions and
no user model — it takes a move list and returns a report.

### Request path for a game review

1. `buildStateTree` walks the SAN move list, evaluating each position once.
   The position *after* move `i` is the position *before* move `i + 1`, so a
   game of N moves costs N + 1 searches, not 2N.
2. Every search runs at **MultiPV ≥ 2**. The classifier reads the second-best
   line to decide `critical` and `brilliant`; with MultiPV 1 those two
   classifications silently never fire.
3. `getGameAnalysis` classifies each node, computes per-move accuracy and
   attaches opening names.
4. `toMoveAnalyses` flattens the position tree into the per-move array.

### Evaluation sign convention

Stockfish reports scores from the perspective of the side to move. Every
`Evaluation` inside the reporter is **white-relative**, so the sign is flipped
exactly once, in `parseInfo`. A mate value of `0` means "the side to move is
mated here" and carries no sign of its own — the winner is whoever played the
move that reached the position.

## Endpoints

All endpoints except `/health` require the `x-analysis-key` header.

### `GET /health`

Unauthenticated, for load balancers. Reports engine config and queue depth.

### `POST /review`

```jsonc
{
  "gameId": "abc123",
  "moves": [{ "san": "e4" }, { "san": "e5" }],
  "initialFen": "…",        // optional, defaults to the start position
  "depth": 16,              // optional, clamped to [MIN_DEPTH, MAX_DEPTH]
  "multiPv": 2,             // optional, floored at 2
  "includeBrilliant": true, // optional, default true
  "includeCritical": true,  // optional, default true
  "includeTheory": true,    // optional, default true
  "includeStateTree": false // optional, default false
}
```

Returns `GameReport` — see [src/services/types.ts](src/services/types.ts).

```jsonc
{
  "gameId": "abc123",
  "engine": { "name": "stockfish", "depth": 16, "multiPv": 2 },
  "moves": [{
    "moveIndex": 0,
    "moveColour": "white",
    "san": "e4",
    "from": "e2", "to": "e4",
    "fen": "…",
    "evaluation": 24,          // white-relative centipawns, ±10000 for mate
    "bestMove": "e2e4", "bestMoveSan": "e4",
    "classification": "theory",
    "evalDiff": 12, "cpLoss": 0,
    "accuracy": 99.99,
    "winChance": 52, "whiteWinChance": 52, "blackWinChance": 48,
    "isMate": false, "mateIn": null,
    "phase": "opening",
    "opening": "King's Pawn Game"
  }],
  "summary": { "white": { /* per-classification counts */ }, "black": { … } },
  "averageAccuracy": { "white": 87.4, "black": 79.1 },
  "phaseAnalysis": { "opening": { … }, "middlegame": { … }, "endgame": { … } },
  "opening": { "name": "Sicilian Defense", "ply": 2 }
}
```

Do **not** infer a move's player from `moveIndex` parity — a review can start
from a black-to-move FEN. Use `moveColour`.

### `POST /position`

```jsonc
{ "fen": "…", "depth": 16, "multiPv": 2 }
```

Returns the top engine lines for one position, for the board's live readout.

## Classifications

Eleven categories, unchanged from WintrChess:

| Classification | Meaning |
|---|---|
| `brilliant` | Sound sacrifice — unsafe piece with real counter-threats, not trapped |
| `critical` | Only move that holds the position; second-best loses ≥ 10% win probability |
| `best` | The engine's top move |
| `excellent` | Expected point loss < 0.045 |
| `okay` | Expected point loss < 0.08 |
| `inaccuracy` | Expected point loss < 0.12 |
| `mistake` | Expected point loss < 0.22 |
| `blunder` | Expected point loss ≥ 0.22 |
| `theory` | Position is in the opening book |
| `forced` | Only legal move |
| `risky` | Reserved; the reporter does not currently emit it |

Accuracy is `103.16 · e^(−4 · pointLoss) − 3.17`, clamped to 0–100. Expected
points are a logistic on centipawns with gradient 0.0035.

## Running it

There are two environment files, chosen by `NODE_ENV`, which the npm scripts
set for you:

| Command | `NODE_ENV` | Reads |
|---|---|---|
| `npm run dev` | `development` | `.env.development` |
| `npm start` | `production` | `.env.production` |

`NODE_ENV` has to come from the script rather than the file, because it is what
decides which file to read. Variables already present in the environment always
win over the file, so a container's `--env-file` or a systemd `Environment=`
line overrides both — and when the file is absent entirely the service logs a
warning and runs on the environment alone, which is the normal production case.

```bash
cp .env.example .env.development   # set ANALYSIS_SERVICE_KEY
cp .env.example .env.production    # same key as the backend
npm install
npm run dev                        # :8090
```

Production:

```bash
npm run build && npm start
```

Both env files hold the shared secret and are gitignored; only `.env.example`,
where it is blank, is committed.

### Stockfish

Install it and point `STOCKFISH_PATH` at the binary — it is spawned as an
external process, so an incorrect path fails every review with
`spawn stockfish ENOENT`.

```bash
brew install stockfish       # macOS  -> /opt/homebrew/bin/stockfish (Apple Silicon)
                             #        -> /usr/local/bin/stockfish   (Intel)
apt-get install stockfish    # Ubuntu -> /usr/games/stockfish
```

On Ubuntu the binary lands in **`/usr/games`**, not `/usr/bin`. That directory
is frequently missing from the `PATH` a systemd service inherits, so set the
absolute path rather than relying on bare `stockfish`.

Docker builds install it for you:

```bash
docker build -t cv-analysis . && docker run -p 8090:8090 --env-file .env cv-analysis
```

## Request logging

Every request is logged twice — once on arrival, once on completion:

```
--> POST /review
review abc123: 7 moves, 8 searches, depth 12, 1018ms
<-- POST /review 200 3515b 1025.360 ms
```

A review holds its request open for as long as the engine takes, so logging
only on completion would leave nothing on screen while a long game runs. The
arrival line answers "did my request even reach the service?" immediately; the
completion line gives the status and the real duration.

Nothing logs headers or bodies — `x-analysis-key` is the shared secret and
must stay out of the log, so any format change has to preserve that.

Health checks are logged in development, where they confirm the service is
reachable, and skipped in production, where a load balancer polls them forever.

## Tuning

Cost is roughly `(moves + 1) × movetime`. A 60-move game at
`MOVETIME_MS=3000` is about three minutes of one core.

| Variable | Effect |
|---|---|
| `MOVETIME_MS` | Hard cap per position. The single biggest lever on latency. |
| `DEFAULT_DEPTH` / `MAX_DEPTH` | Search depth. Requests are clamped, never rejected. |
| `MAX_CONCURRENT_SEARCHES` | Size of the engine pool — the real CPU bound. Keep ≤ core count. |
| `MAX_CONCURRENT_REVIEWS` | How many reviews run at once; the rest queue. |
| `ENGINE_THREADS` / `ENGINE_HASH_MB` | Per-engine Stockfish resources. |

Engines are pooled and long-lived. A review acquires and releases one **per
position** rather than holding it for the whole run, so concurrent reviews
interleave fairly instead of one starving the others.

## Notes for maintainers

- `MOVETIME_MS` is a wall-clock cap, so on a loaded box a search returns at a
  shallower depth than requested rather than blocking. The depth actually
  reached is reported per line.
- Illegal SAN truncates a review instead of failing it — the moves analysed
  before the bad one are still returned.
- WintrChess's `getGameAnalysis` returned hard-coded `estimatedRatings` of
  2000/1000. Those were placeholders, so this port omits the field rather
  than shipping made-up ratings.

## Licence

cv-analysis is free software, licensed under the **GNU General Public License
v3.0 or later**. Chessveda is a chess platform operated by Midas 24x7 Games
Private Limited, which holds the copyright.

    Copyright (C) 2026 Midas 24x7 Games Private Limited

    This program is free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by the Free
    Software Foundation, either version 3 of the License, or (at your option)
    any later version.

    This program is distributed in the hope that it will be useful, but
    WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
    Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program. If not, see <https://www.gnu.org/licenses/>.

It is GPL-3.0 because it is a derived work of
[WintrChess](https://github.com/WintrCat/wintrchess) — the move classification
and accuracy engine is a port of theirs, with credit to WintrCat and
contributors. Every derived file says so in its header, and
[NOTICE](./NOTICE) lists exactly which files are derived and what was changed.

Stockfish is a separate GPL-3.0 program, invoked as an external binary. It is
not linked into this program and is not redistributed here.
