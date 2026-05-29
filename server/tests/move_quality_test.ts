import { assert, assertEquals } from "@std/assert";
import { calculateMoveQuality, normalizeKataGoMove } from "../move-quality.ts";

Deno.test("normalizeKataGoMove normalizes strings and coordinates", () => {
  assertEquals(normalizeKataGoMove(" q16 "), "Q16");
  assertEquals(normalizeKataGoMove([3, 4]), "3,4");
});

Deno.test("calculateMoveQuality waits for previous analysis", () => {
  const result = calculateMoveQuality({
    moveNumber: 1,
    color: "black",
    move: "Q16",
  });

  assertEquals(result, undefined);
});

Deno.test("calculateMoveQuality marks previous top move blue", () => {
  const result = calculateMoveQuality({
    moveNumber: 3,
    color: "black",
    move: "Q16",
    previousAnalysis: {
      moveInfos: [
        { move: "Q16", winrate: 0.55 },
        { move: "D4", winrate: 0.53 },
      ],
    },
  });

  assert(result);
  assertEquals(result.scoreLoss, 0);
  assertEquals(result.quality, "blue");
});

Deno.test("calculateMoveQuality buckets black WR loss", () => {
  const result = calculateMoveQuality({
    moveNumber: 3,
    color: "black",
    move: "D4",
    previousAnalysis: {
      moveInfos: [
        { move: "Q16", winrate: 0.55 },
        { move: "D4", winrate: 0.51 },
      ],
    },
  });

  assert(result);
  assertEquals(Math.round((result.scoreLoss ?? 0) * 10) / 10, 4);
  assertEquals(result.quality, "yellow");
});

Deno.test("calculateMoveQuality buckets white WR loss", () => {
  const result = calculateMoveQuality({
    moveNumber: 4,
    color: "white",
    move: "D16",
    previousAnalysis: {
      moveInfos: [
        { move: "Q4", winrate: 0.45 },
        { move: "D16", winrate: 0.52 },
      ],
    },
  });

  assert(result);
  assertEquals(Math.round((result.scoreLoss ?? 0) * 10) / 10, 7);
  assertEquals(result.quality, "red");
});

Deno.test("calculateMoveQuality falls back to current root WR", () => {
  const result = calculateMoveQuality({
    moveNumber: 5,
    color: "black",
    move: "C3",
    previousAnalysis: {
      moveInfos: [{ move: "Q16", winrate: 0.5 }],
    },
    currentAnalysis: { rootInfo: { winrate: 0.48 } },
  });

  assert(result);
  assertEquals(Math.round((result.scoreLoss ?? 0) * 10) / 10, 2);
  assertEquals(result.quality, "green");
});
