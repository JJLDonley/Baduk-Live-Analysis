import { assertEquals } from "@std/assert";
import { buildAnalysisPayloadFromSnapshot } from "../analysis-payload.ts";
import { GameContext, GameStateSnapshot } from "../models.ts";

function snapshot(): GameStateSnapshot {
  return {
    id: "123",
    context: { type: "game", id: "123" },
    boardSize: 19,
    rules: "chinese",
    komi: 7.5,
    initialStones: [["black", "D4"]],
    moves: [
      { moveNumber: 1, color: "black", move: "Q16", coordinates: [15, 3] },
      { moveNumber: 2, color: "white", move: "pass", coordinates: null },
      { moveNumber: 3, color: "black", move: "D4", coordinates: [3, 15] },
    ],
    updatedAt: 1,
  };
}

Deno.test("buildAnalysisPayloadFromSnapshot builds KataGo payload from backend state", () => {
  const payload = buildAnalysisPayloadFromSnapshot(
    new GameContext("game", "123"),
    snapshot(),
    { id: "custom", moveNumber: 2, includeOwnership: true, maxVisits: 25 },
    10,
  );

  assertEquals(payload.id, "custom");
  assertEquals(payload.moves, [["black", "Q16"], ["white", "pass"]]);
  assertEquals(payload.initialStones, [["black", "D4"]]);
  assertEquals(payload.rules, "chinese");
  assertEquals(payload.komi, 7.5);
  assertEquals(payload.maxVisits, 25);
});

Deno.test("buildAnalysisPayloadFromSnapshot clamps moveNumber", () => {
  const payload = buildAnalysisPayloadFromSnapshot(
    new GameContext("game", "123"),
    snapshot(),
    { moveNumber: 99 },
    10,
  );

  assertEquals(payload.id, "game_123_move_3");
  assertEquals(payload.moves.length, 3);
});
