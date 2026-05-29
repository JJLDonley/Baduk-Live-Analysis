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
  const showArea = has("area", "score", "counting", "points");
  const showTerritory = has("territory");
  const showScore = showArea || showTerritory;
  const showShape = has("shape", "pattern", "shape-name");
  const showStatus = has("status", "game-status");
  const showClock = has("clock", "clocks");
  const showPlayer = has("player", "players", "names", "player-info");
  const showPie = has("pie", "winrate", "wr");
  const showLegend = has("legend", "colors", "colour", "colours");
  const showIndex = has(
    "index",
    "mqi",
    "move",
    "quality",
    "move-quality",
    "counter",
  );
  const showEval = has("eval", "bar", "winrate-bar");
  const showAllInfo = has("information", "info");
  const showInfo = showClock || showPlayer || showPie || showLegend ||
    showAllInfo;

  const hiddenSelectors = [
    !showBoard && ".goboard",
    !showScore && ".counting",
    !showEval && ".winrate-bar-section",
    !showShape && ".shape-name",
    !showStatus && ".game-status",
    !showInfo && ".information",
    !showIndex && !showAllInfo && ".move-quality-counter",
    showInfo && !showClock && !showAllInfo && ".clock",
    showInfo && !showPlayer && !showAllInfo && ".player-label",
    showInfo && !showPie && !showLegend && !showAllInfo && ".winrate",
    showInfo && !showPie && !showAllInfo && "#pie, #pie-over, #pie-text",
    showInfo && !showLegend && !showAllInfo && ".move-quality-indicator",
  ].filter((selector): selector is string => Boolean(selector));

  const style = `<style id="server-element-filter">${
    hiddenSelectors.join(",")
  } { display: none !important; }</style>`;
  return index.replace("</head>", `${style}\n</head>`);
}
