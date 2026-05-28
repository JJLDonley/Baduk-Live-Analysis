export function getRequestedElements(url: URL): Set<string> {
  const values = [
    url.searchParams.get("element"),
    url.searchParams.get("elements"),
  ].filter((value): value is string => Boolean(value));

  return new Set(
    values.flatMap((value) => value.split(","))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function withElementVisibility(index: string, url: URL): string {
  const requested = getRequestedElements(url);
  if (requested.size === 0 || requested.has("all")) return index;

  const has = (...names: string[]) => names.some((name) => requested.has(name));
  const showBoard = has("board", "goban", "goboard");
  const showScore = has("score", "counting", "points");
  const showShape = has("shape", "pattern", "shape-name");
  const showStatus = has("status", "game-status");
  const showClock = has("clock", "clocks");
  const showPlayer = has("player", "players", "names", "player-info");
  const showPie = has("pie", "winrate", "wr");
  const showBar = has("bar", "winrate-bar");
  const showMove = has("move", "quality", "move-quality", "counter");
  const showIndex = has("index", "mqi", "move-quality-index");
  const showInfo = showClock || showPlayer || showPie || showMove ||
    showIndex || has("information", "info");
  const showAllInfo = has("information", "info");

  const hiddenSelectors = [
    !showBoard && ".goboard",
    !showScore && ".counting",
    !showBar && ".winrate-bar",
    !showShape && ".shape-name",
    !showStatus && ".game-status",
    !showInfo && ".information",
    !showIndex && !showAllInfo && ".move-quality-index",
    showInfo && !showClock && !showAllInfo && ".clock",
    showInfo && !showPlayer && !showAllInfo && ".player-name",
    showInfo && !showPie && !showMove && !showAllInfo && ".winrate",
    showInfo && !showPie && !showAllInfo &&
    "#pie, #pie-over, #pie-text, .turn-indicator-left, .turn-indicator-right",
    showInfo && !showMove && !showAllInfo && ".move-quality-indicator",
  ].filter((selector): selector is string => Boolean(selector));

  const style = `<style id="server-element-filter">${
    hiddenSelectors.join(",")
  } { display: none !important; }</style>`;
  return index.replace("</head>", `${style}\n</head>`);
}
