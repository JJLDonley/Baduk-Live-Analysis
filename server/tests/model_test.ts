import { assertEquals } from "@std/assert";
import {
  classifyMoveQuality,
  GameContext,
  MoveQualityTracker,
  parseClientCommand,
} from "../models.ts";

Deno.test("classifyMoveQuality uses BLA score-loss thresholds", () => {
  assertEquals(classifyMoveQuality(null), "unknown");
  assertEquals(classifyMoveQuality(0.49), "blue");
  assertEquals(classifyMoveQuality(0.5), "green");
  assertEquals(classifyMoveQuality(1.49), "green");
  assertEquals(classifyMoveQuality(1.5), "yellow");
  assertEquals(classifyMoveQuality(2.99), "yellow");
  assertEquals(classifyMoveQuality(3), "red");
});

Deno.test("MoveQualityTracker tracks per-player counts and averages", () => {
  const tracker = new MoveQualityTracker();
  tracker.record({
    moveNumber: 1,
    color: "black",
    move: "D4",
    scoreLoss: 0.2,
    quality: "blue",
  });
  tracker.record({
    moveNumber: 2,
    color: "white",
    move: "Q16",
    scoreLoss: 2,
    quality: "yellow",
  });
  const state = tracker.record({
    moveNumber: 3,
    color: "black",
    move: "C3",
    scoreLoss: 4,
    quality: "red",
  });

  assertEquals(state.summary.black.blue, 1);
  assertEquals(state.summary.black.red, 1);
  assertEquals(state.summary.black.total, 2);
  assertEquals(state.summary.black.averageScoreLoss, 2.1);
  assertEquals(state.summary.white.yellow, 1);
  assertEquals(state.summary.white.total, 1);
});

Deno.test("GameContext validates type and id", () => {
  assertEquals(GameContext.fromUnknown("game", 123)?.key(), "game/123");
  assertEquals(GameContext.fromUnknown("review", "abc")?.key(), "review/abc");
  assertEquals(GameContext.fromUnknown("demo", "1"), null);
  assertEquals(GameContext.fromUnknown("game", ""), null);
});

Deno.test("parseClientCommand accepts valid command envelope", () => {
  const command = parseClientCommand({
    type: "command",
    command: "connect-context",
    context: { type: "game", id: "123" },
    requestId: "r1",
  });

  assertEquals(command?.command, "connect-context");
  assertEquals(command?.context, { type: "game", id: "123" });
  assertEquals(command?.requestId, "r1");
});

Deno.test("parseClientCommand accepts sync-state command", () => {
  const command = parseClientCommand({
    type: "command",
    command: "sync-state",
    context: { type: "review", id: "abc" },
    payload: { moves: [] },
  });

  assertEquals(command?.command, "sync-state");
  assertEquals(command?.context, { type: "review", id: "abc" });
});

Deno.test("parseClientCommand keeps request-analysis payload", () => {
  const payload = { id: "123/game/4", moves: [["black", "D4"]] };
  const command = parseClientCommand({
    type: "command",
    command: "request-analysis",
    context: { type: "game", id: "123" },
    payload,
  });

  assertEquals(command?.command, "request-analysis");
  assertEquals(command?.payload, payload);
});

Deno.test("parseClientCommand rejects invalid commands", () => {
  assertEquals(
    parseClientCommand({ type: "command", command: "raw-ai" }),
    null,
  );
  assertEquals(
    parseClientCommand({
      type: "command",
      command: "connect-context",
      context: { type: "demo", id: "1" },
    }),
    null,
  );
  assertEquals(parseClientCommand({ type: "legacy" }), null);
});
