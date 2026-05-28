import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  getRequestedElements,
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

Deno.test("withElementVisibility injects server-side hiding CSS", () => {
  const html = "<html><head></head><body></body></html>";
  const url = new URL("http://localhost/game/1?element=board");
  const filtered = withElementVisibility(html, url);

  assertStringIncludes(filtered, "server-element-filter");
  assertStringIncludes(filtered, ".information");
  assertStringIncludes(filtered, ".counting");
});

Deno.test("withElementVisibility does not inject when all elements are requested", () => {
  const html = "<html><head></head><body></body></html>";
  const url = new URL("http://localhost/game/1?element=all");
  assertEquals(withElementVisibility(html, url), html);
});
