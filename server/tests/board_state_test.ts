import { assertEquals } from "@std/assert";
import { replayMoves } from "../board-state.ts";
import { Move } from "../models.ts";

Deno.test("replayMoves places stones and passes", () => {
  const result = replayMoves([
    { moveNumber: 1, color: "black", move: "A1", coordinates: [0, 0] },
    { moveNumber: 2, color: "white", move: "pass", coordinates: null },
  ], 5);

  assertEquals(result.board[0][0], 1);
  assertEquals(result.captures, { black: 0, white: 0 });
  assertEquals(result.errors, []);
});

Deno.test("replayMoves captures a surrounded stone", () => {
  const moves: Move[] = [
    { moveNumber: 1, color: "black", move: "B2", coordinates: [1, 1] },
    { moveNumber: 2, color: "white", move: "A2", coordinates: [0, 1] },
    { moveNumber: 3, color: "white", move: "B1", coordinates: [1, 0] },
    { moveNumber: 4, color: "white", move: "C2", coordinates: [2, 1] },
    { moveNumber: 5, color: "white", move: "B3", coordinates: [1, 2] },
  ];

  const result = replayMoves(moves, 5);
  assertEquals(result.board[1][1], 0);
  assertEquals(result.captures.white, 1);
  assertEquals(result.errors, []);
});

Deno.test("replayMoves rejects occupied moves", () => {
  const result = replayMoves([
    { moveNumber: 1, color: "black", move: "A1", coordinates: [0, 0] },
    { moveNumber: 2, color: "white", move: "A1", coordinates: [0, 0] },
  ], 5);

  assertEquals(result.board[0][0], 1);
  assertEquals(result.errors.length, 1);
});

Deno.test("replayMoves rejects suicide", () => {
  const result = replayMoves([
    { moveNumber: 1, color: "black", move: "A2", coordinates: [0, 1] },
    { moveNumber: 2, color: "black", move: "B1", coordinates: [1, 0] },
    { moveNumber: 3, color: "white", move: "A1", coordinates: [0, 0] },
  ], 5);

  assertEquals(result.board[0][0], 0);
  assertEquals(result.errors[0].includes("suicide"), true);
});
