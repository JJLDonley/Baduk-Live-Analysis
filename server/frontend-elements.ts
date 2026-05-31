export function getRequestedElements(url: URL): Set<string> {
  const values = [
    url.searchParams.get("element"),
    url.searchParams.get("elements"),
  ].filter((value): value is string => Boolean(value));

  return parseElementList(values);
}

export function getRequestedSideElements(
  url: URL,
): { black: Set<string>; white: Set<string> } {
  return {
    black: parseElementList(
      [url.searchParams.get("black")].filter(Boolean) as string[],
    ),
    white: parseElementList(
      [url.searchParams.get("white")].filter(Boolean) as string[],
    ),
  };
}

function parseElementList(values: string[]): Set<string> {
  return new Set(
    values.flatMap((value) => value.split(","))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function hasToken(requested: Set<string>, ...names: string[]): boolean {
  return names.some((name) => requested.has(name));
}

function hasClock(requested: Set<string>): boolean {
  return hasToken(requested, "clock", "clocks");
}

function hasPlayer(requested: Set<string>): boolean {
  return hasToken(requested, "player", "players", "names", "player-info");
}

function hasIndex(requested: Set<string>): boolean {
  return hasToken(
    requested,
    "index",
    "mqi",
    "move",
    "quality",
    "move-quality",
    "counter",
  );
}

function hasPoints(requested: Set<string>): boolean {
  return hasToken(requested, "points", "score", "area", "territory");
}

function hasWinrate(requested: Set<string>): boolean {
  return hasToken(requested, "winrate", "wr", "eval");
}

export function withElementVisibility(index: string, url: URL): string {
  const requested = getRequestedElements(url);
  const sideRequested = getRequestedSideElements(url);
  const hasSideFilters = sideRequested.black.size > 0 ||
    sideRequested.white.size > 0;
  if (
    requested.size === 0 && !hasSideFilters ||
    requested.has("all")
  ) return index;

  const has = (...names: string[]) => hasToken(requested, ...names);
  const showBoard = has("board", "goban", "goboard");
  const showArea = has("area", "score", "counting", "points");
  const showTerritory = has("territory");
  const showScore = showArea || showTerritory;
  const showShape = has("shape", "pattern", "shape-name");
  const showStatus = has("status", "game-status");
  const showGlobalClock = hasClock(requested);
  const showGlobalPlayer = hasPlayer(requested);
  const showPie = has("pie", "winrate", "wr");
  const showLegend = has("legend", "colors", "colour", "colours");
  const showGlobalIndex = hasIndex(requested);
  const showEval = has("eval", "bar", "winrate-bar");
  const showResult = has("result", "results", "winner", "outcome", "game-over");
  const showAllInfo = has("information", "info");

  const showBlackClock = showAllInfo ||
    (hasSideFilters ? hasClock(sideRequested.black) : showGlobalClock);
  const showWhiteClock = showAllInfo ||
    (hasSideFilters ? hasClock(sideRequested.white) : showGlobalClock);
  const showBlackPlayer = showAllInfo ||
    (hasSideFilters ? hasPlayer(sideRequested.black) : showGlobalPlayer);
  const showWhitePlayer = showAllInfo ||
    (hasSideFilters ? hasPlayer(sideRequested.white) : showGlobalPlayer);
  const showBlackIndex = showAllInfo ||
    (hasSideFilters ? hasIndex(sideRequested.black) : showGlobalIndex);
  const showWhiteIndex = showAllInfo ||
    (hasSideFilters ? hasIndex(sideRequested.white) : showGlobalIndex);
  const showBlackPoints = hasSideFilters && hasPoints(sideRequested.black);
  const showWhitePoints = hasSideFilters && hasPoints(sideRequested.white);
  const showBlackWinrate = hasSideFilters && hasWinrate(sideRequested.black);
  const showWhiteWinrate = hasSideFilters && hasWinrate(sideRequested.white);

  const showInfo = showBlackClock || showWhiteClock || showBlackPlayer ||
    showWhitePlayer || showPie || showLegend || showBlackWinrate ||
    showWhiteWinrate || showAllInfo;
  const showAnyIndex = showBlackIndex || showWhiteIndex;

  const hiddenSelectors = [
    !showBoard && ".goboard",
    !(showScore || showBlackPoints || showWhitePoints) && ".counting",
    !(showEval || showBlackWinrate || showWhiteWinrate) &&
    ".winrate-bar-section",
    !showShape && ".shape-name",
    !showStatus && ".game-status",
    !showResult && ".result-modal",
    !showInfo && ".information",
    !showAnyIndex && ".move-quality-counter",
    showInfo && !showBlackClock && "#black-clock",
    showInfo && !showWhiteClock && "#white-clock",
    showInfo && !showBlackPlayer && ".player-label.black",
    showInfo && !showWhitePlayer && ".player-label.white",
    showInfo && !showBlackClock && !showBlackPlayer && ".player-panel.black",
    showInfo && !showWhiteClock && !showWhitePlayer && ".player-panel.white",
    showInfo && !showPie && !showLegend && !showAllInfo && ".winrate",
    showInfo && !showPie && !showAllInfo && "#pie, #pie-over, #pie-text",
    showInfo && !showLegend && !showAllInfo && ".move-quality-indicator",
    (showScore || showBlackPoints || showWhitePoints) && hasSideFilters &&
    !showBlackPoints && !showScore && "#black-points",
    (showScore || showBlackPoints || showWhitePoints) && hasSideFilters &&
    !showWhitePoints && !showScore && "#white-points",
    (showBlackPoints || showWhitePoints) && !showScore &&
    "#unclaimed-points, #confidence-bar",
    (showEval || showBlackWinrate || showWhiteWinrate) && hasSideFilters &&
    !showBlackWinrate && !showEval && "#winrate-bar-black-label",
    (showEval || showBlackWinrate || showWhiteWinrate) && hasSideFilters &&
    !showWhiteWinrate && !showEval && "#winrate-bar-white-label",
    (showBlackWinrate || showWhiteWinrate) && !showEval && "#winrate-bar",
    showAnyIndex && !showBlackIndex && ".mqi-player.black",
    showAnyIndex && !showWhiteIndex && ".mqi-player.white",
  ].filter((selector): selector is string => Boolean(selector));

  const hideCss = hiddenSelectors.length > 0
    ? `${hiddenSelectors.join(",")} { display: none !important; }`
    : "";
  const leftAlignCss = `
body {
  padding: 0 !important;
  min-height: auto !important;
  align-items: flex-start !important;
}
.container {
  align-items: flex-start !important;
}
`;
  const compactCss = requested.size > 0 || hasSideFilters
    ? `
body {
  background: transparent !important;
  padding: 0 !important;
  min-height: auto !important;
  align-items: flex-start !important;
}
.container {
  align-items: flex-start !important;
  gap: 4px !important;
}
.information {
  ${showInfo ? "display: flex !important;" : ""}
  width: auto !important;
  padding: 0 !important;
  gap: 8px !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  backdrop-filter: none !important;
}
.player-panel {
  width: auto !important;
  justify-self: auto !important;
}
.player-panel.white,
.player-panel.white .player-label {
  align-items: flex-start !important;
  justify-content: flex-start !important;
}
.player-label .turn-stone {
  display: inline-block !important;
  opacity: 0.3;
}
.player-label .turn-stone.active {
  opacity: 1;
}
.move-quality-counter {
  width: auto !important;
  justify-content: flex-start !important;
  margin-top: 0 !important;
}
`
    : "";
  const style =
    `<style id="server-element-filter">${leftAlignCss}${compactCss}${hideCss}</style>`;
  return index.replace("</head>", `${style}\n</head>`);
}
