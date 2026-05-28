import { assertEquals, assertThrows } from "@std/assert";
import { AnalysisCache } from "../analysis-cache.ts";

Deno.test("AnalysisCache stores and retrieves values", () => {
  const cache = new AnalysisCache<number>(2);
  cache.set("a", 1);
  assertEquals(cache.get("a"), 1);
  assertEquals(cache.size, 1);
});

Deno.test("AnalysisCache evicts least recently used entry", () => {
  const cache = new AnalysisCache<number>(2);
  cache.set("a", 1);
  cache.set("b", 2);
  assertEquals(cache.get("a"), 1); // refresh a
  cache.set("c", 3);

  assertEquals(cache.get("a"), 1);
  assertEquals(cache.get("b"), undefined);
  assertEquals(cache.get("c"), 3);
});

Deno.test("AnalysisCache replaces existing value without growing", () => {
  const cache = new AnalysisCache<number>(2);
  cache.set("a", 1);
  cache.set("a", 2);

  assertEquals(cache.get("a"), 2);
  assertEquals(cache.size, 1);
});

Deno.test("AnalysisCache validates max size", () => {
  assertThrows(() => new AnalysisCache<number>(0));
});
