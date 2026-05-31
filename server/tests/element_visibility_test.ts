import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  getRequestedElements,
  getRequestedSideElements,
  withElementVisibility,
} from "../frontend-elements.ts";

Deno.test("getRequestedElements parses element and elements parameters", () => {
  const url = new URL(
    "http://localhost/game/1?element=board&elements=score,shape",
  );
  assertEquals([...getRequestedElements(url)].sort(), [
    "board",
    "score",
    "shape",
  ]);
});

Deno.test("getRequestedSideElements parses black and white parameters", () => {
  const url = new URL(
    "http://localhost/game/1?black=player,index,clock&white=clock",
  );
  const requested = getRequestedSideElements(url);
  assertEquals([...requested.black].sort(), ["clock", "index", "player"]);
  assertEquals([...requested.white].sort(), ["clock"]);
});

Deno.test("withElementVisibility injects server-side hiding CSS", () => {
  const html = "<html><head></head><body></body></html>";
  const url = new URL("http://localhost/game/1?element=board");
  const filtered = withElementVisibility(html, url);

  assertStringIncludes(filtered, "server-element-filter");
  assertStringIncludes(filtered, ".information");
  assertStringIncludes(filtered, ".counting");
});

Deno.test("withElementVisibility supports side-specific modules", () => {
  const html = "<html><head></head><body></body></html>";
  const url = new URL("http://localhost/game/1?black=player,index,clock");
  const filtered = withElementVisibility(html, url);

  assertStringIncludes(filtered, "#white-clock");
  assertStringIncludes(filtered, ".player-label.white");
  assertStringIncludes(filtered, ".mqi-player.white");
  assertStringIncludes(filtered, ".goboard");
  assertStringIncludes(filtered, "background: transparent");
  assertStringIncludes(filtered, "width: auto");
});

Deno.test("withElementVisibility supports side-specific points and winrate", () => {
  const html = "<html><head></head><body></body></html>";
  const url = new URL("http://localhost/game/1?black=points,winrate");
  const filtered = withElementVisibility(html, url);

  assertStringIncludes(filtered, "#white-points");
  assertStringIncludes(filtered, "#unclaimed-points, #confidence-bar");
  assertStringIncludes(filtered, "#winrate-bar-white-label");
  assertStringIncludes(filtered, "#winrate-bar");
});

Deno.test("withElementVisibility does not inject when all elements are requested", () => {
  const html = "<html><head></head><body></body></html>";
  const url = new URL("http://localhost/game/1?element=all");
  assertEquals(withElementVisibility(html, url), html);
});
