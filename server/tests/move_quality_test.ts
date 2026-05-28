import { assertEquals } from "@std/assert";
import { calculateMoveQuality, normalizeKataGoMove } from "../move-quality.ts";

Deno.test("normalizeKataGoMove normalizes strings and coordinates", () => {
  assertEquals(normalizeKataGoMove(" q16 "), "Q16");
  assertEquals(normalizeKataGoMove([3, 4]), "3,4");
});

Deno.test("calculateMoveQuality returns unknown without previous analysis", () => {
  const result = calculateMoveQuality({
    moveNumber: 1,
    color: "black",
    move: "Q16",
  });

  assertEquals(result.quality, "unknown");
  assertEquals(result.scoreLoss, null);
});

Deno.test("calculateMoveQuality buckets black score loss", () => {
  const result = calculateMoveQuality({
    moveNumber: 3,
    color: "black",
    move: "D4",
    previousAnalysis: {
      moveInfos: [
        { move: "Q16", scoreLead: 5 },
        { move: "D4", scoreLead: 3.2 },
      ],
    },
  });

  assertEquals(result.scoreLoss, 1.7999999999999998);
  assertEquals(result.quality, "yellow");
});

Deno.test("calculateMoveQuality buckets white score loss", () => {
  const result = calculateMoveQuality({
    moveNumber: 4,
    color: "white",
    move: "D16",
    previousAnalysis: {
      moveInfos: [
        { move: "Q4", scoreLead: -4 },
        { move: "D16", scoreLead: -2 },
      ],
    },
  });

  assertEquals(result.scoreLoss, 2);
  assertEquals(result.quality, "yellow");
});

Deno.test("calculateMoveQuality falls back to current root score", () => {
  const result = calculateMoveQuality({
    moveNumber: 5,
    color: "black",
    move: "C3",
    previousAnalysis: {
      moveInfos: [{ move: "Q16", scoreLead: 10 }],
    },
    currentAnalysis: { rootInfo: { scoreLead: 9.7 } },
  });

  assertEquals(Math.round((result.scoreLoss ?? 0) * 10) / 10, 0.3);
  assertEquals(result.quality, "blue");
});
