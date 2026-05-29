# BLA Improvement Plan

## Goals

- Make the backend the source of truth for game/review state, AI analysis, move
  quality counts, and protocol validation.
- Keep the frontend render-focused: it receives server events and paints UI
  only.
- Use a command/event protocol instead of raw ad-hoc WebSocket payloads.
- Add strict data models and tests around command handling, analysis data, and
  move quality tracking.
- Clean dead code and reduce duplicated frontend/backend logic over time.
- Support URL parameter element handling so embedders can request only specific
  UI elements.

## Target data flow

```txt
Client -> Server -> AI -> Server -> Client
```

The client should not format direct AI requests or depend on raw AI response
details long term. It sends commands. The backend validates commands, owns
game/session state, requests AI analysis, computes derived data, then emits
render-ready events.

## Architecture target

```txt
client/
  render-only UI
  command websocket client
  renderers/
    board
    clocks
    score/winrate
    move quality summary
    pattern name

server/
  command router
  strict models
  session manager
  OGS integration
  analysis service
  KataGo service
  move quality tracker
  validation
  tests
```

## Strict data models

Create shared backend models for:

- `GameContext`
- `Move`
- `AnalysisRequest`
- `AnalysisResponse`
- `MoveQuality`
- `MoveQualitySummary`
- `ClientCommand`
- `ServerEvent`

Move quality buckets use black-perspective KataGo WR% loss from the player who moved:

- `blue`: played KataGo's top move
- `green`: WR loss `< 3pp`
- `yellow`: WR loss `>= 3pp && < 6pp`
- `red`: WR loss `>= 6pp`
- `unknown`: missing/invalid comparison data

This tracker is not the same as the frontend's current move marker coloring. It
tracks counts and per-player summary over the game/review.

## Command protocol

Client messages should become commands:

```json
{
  "type": "command",
  "command": "request-analysis",
  "context": { "type": "game", "id": "123" },
  "payload": {}
}
```

Server messages should become events:

```json
{
  "type": "event",
  "event": "analysis-completed",
  "context": { "type": "game", "id": "123" },
  "payload": {}
}
```

Initial implementation may preserve legacy analysis payloads for compatibility,
but all new features should use models and command-compatible shape.

## Backend ownership roadmap

1. Backend validates game/review context.
2. Backend deduplicates analysis by context and position.
3. Backend maintains move quality state per context.
4. Backend exposes move quality summary to frontend.
5. Backend eventually connects to OGS directly and owns game/review parsing.
6. Frontend only sends commands and renders events.

## AI reliability roadmap

- Use one KataGo stdout reader loop.
- Match responses by `id`.
- Prevent timed-out reads from corrupting later reads.
- Restart or drain KataGo safely after timeout.
- Add tests for stale responses and timeouts.

## Testing roadmap

Add real `Deno.test()` tests for:

- data model validation
- command parsing
- move quality bucket thresholds
- move quality summaries by player
- analysis cache keys
- pass moves
- handicap/initial stones
- review move parsing
- invalid WebSocket commands

Required commands before merge:

```bash
deno fmt
deno lint
deno check server.ts server/server.ts server/*.ts
deno test --allow-read --allow-net server/tests
```

## Frontend URL element handling

Add URL parameters:

- `?element=board`
- `?element=clock`
- `?element=players`
- `?element=winrate`
- `?element=score`
- `?element=shape`
- `?element=status`
- `?elements=board,score,shape`

When provided, hide all non-requested UI sections. This supports
overlay/embedding use cases.

## Dead code cleanup roadmap

- Convert old script-style tests into `Deno.test()` or remove them.
- Remove duplicate frontend move-quality calculations once backend quality
  events are rendered.
- Remove standalone raw AI helper paths once command protocol is complete.
- Replace excessive `console.log` calls with a log-level utility.
- Remove unused config options or implement them.
