import { assertEquals } from "@std/assert";
import {
  mergeAnalysisSettings,
  normalizeAnalysisSettings,
} from "../analysis-settings.ts";

Deno.test("normalizeAnalysisSettings clamps maxVisits", () => {
  assertEquals(normalizeAnalysisSettings({ maxVisits: 500 }, 100), {
    maxVisits: 100,
  });
});

Deno.test("normalizeAnalysisSettings accepts boolean flags", () => {
  assertEquals(
    normalizeAnalysisSettings(
      { includePolicy: true, includeOwnership: false },
      100,
    ),
    { includePolicy: true, includeOwnership: false },
  );
});

Deno.test("normalizeAnalysisSettings rejects invalid payloads", () => {
  assertEquals(normalizeAnalysisSettings(null, 100), null);
  assertEquals(normalizeAnalysisSettings({ maxVisits: 0 }, 100), null);
  assertEquals(normalizeAnalysisSettings({ includePolicy: "yes" }, 100), null);
});

Deno.test("mergeAnalysisSettings applies overrides", () => {
  assertEquals(
    mergeAnalysisSettings(
      { maxVisits: 50, includePolicy: false, includeOwnership: true },
      { includePolicy: true },
    ),
    { maxVisits: 50, includePolicy: true, includeOwnership: true },
  );
});
