import { assertEquals } from "@std/assert";
import { normalizeGameStateSnapshot, normalizeMoves } from "../game-state.ts";
import { GameContext } from "../models.ts";

Deno.test("normalizeMoves accepts frontend move snapshots", () => {
  const moves = normalizeMoves([
    { moveNumber: 1, color: "black", move: "D4", coordinates: [3, 15] },
    { moveNumber: 2, color: "white", move: "pass", coordinates: null },
  ]);

  assertEquals(moves, [
    { moveNumber: 1, color: "black", move: "D4", coordinates: [3, 15] },
    { moveNumber: 2, color: "white", move: "pass", coordinates: null },
  ]);
});

Deno.test("normalizeMoves rejects invalid colors", () => {
  assertEquals(normalizeMoves([{ color: "blue", move: "D4" }]), null);
});

Deno.test("normalizeGameStateSnapshot creates backend-owned session snapshot", () => {
  const context = new GameContext("game", "123");
  const snapshot = normalizeGameStateSnapshot(context, {
    moves: [{ color: "black", move: "Q16", coordinates: [15, 3] }],
    currentPlayer: "white",
    boardSize: 19,
    rules: "chinese",
    komi: 7.5,
    initialStones: [["black", "D4"]],
    captures: { black: 1, white: 2 },
  });

  assertEquals(snapshot?.context, { type: "game", id: "123" });
  assertEquals(snapshot?.moves.length, 1);
  assertEquals(snapshot?.currentPlayer, "white");
  assertEquals(snapshot?.rules, "chinese");
  assertEquals(snapshot?.komi, 7.5);
  assertEquals(snapshot?.initialStones, [["black", "D4"]]);
  assertEquals(snapshot?.captures, { black: 1, white: 2 });
  assertEquals(snapshot?.board?.[3][15], 1);
  assertEquals(snapshot?.boardErrors, []);
});
