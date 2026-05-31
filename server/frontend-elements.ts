export function getRequestedElements(url: URL): Set<string> {
  const requested = parseElementList([
    url.searchParams.get("element"),
    url.searchParams.get("elements"),
  ].filter((value): value is string => Boolean(value)));

  for (
    const [param, element] of [
      ["board", "board"],
      ["pie", "pie"],
      ["l", "legend"],
      ["legend", "legend"],
      ["r", "result"],
      ["result", "result"],
    ]
  ) {
    if (url.searchParams.has(param)) requested.add(element);
  }

  return requested;
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

function getParamTokenSet(url: URL, name: string): Set<string> {
  return parseElementList([url.searchParams.get(name) ?? ""]);
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
  const territoryRequested = getParamTokenSet(url, "t");
  const areaRequested = getParamTokenSet(url, "a");
  const evalRequested = getParamTokenSet(url, "e");
  const playerRequested = getParamTokenSet(url, "p");
  const sideRequested = getRequestedSideElements(url);
  const hasSideFilters = sideRequested.black.size > 0 ||
    sideRequested.white.size > 0;
  const hasShortParams = ["t", "a", "e", "p"].some((name) =>
    url.searchParams.has(name)
  );
  if (requested.has("all")) return index;
  if (requested.size === 0 && !hasSideFilters && !hasShortParams) return index;

  const has = (...names: string[]) => hasToken(requested, ...names);
  const tokenHas = (set: Set<string>, ...names: string[]) =>
    names.some((name) => set.has(name));

  const showBoard = has("board", "goban", "goboard");
  const showTerritory = territoryRequested.size > 0 || has("territory");
  const showArea = areaRequested.size > 0 ||
    has("area", "score", "counting", "points");
  const showScore = showArea || showTerritory;
  const showStatus = has("status", "game-status");
  const showGlobalClock = hasClock(requested);
  const showGlobalPlayer = hasPlayer(requested);
  const showPie = has("pie", "winrate", "wr");
  const showLegend = has("legend", "colors", "colour", "colours");
  const showGlobalIndex = hasIndex(requested);
  const showEval = evalRequested.size > 0 || has("eval", "bar", "winrate-bar");
  const showResult = has("result", "results", "winner", "outcome", "game-over");
  const showAllInfo = has("information", "info");

  const showBlackClock = showAllInfo || tokenHas(playerRequested, "b", "bc") ||
    (hasSideFilters ? hasClock(sideRequested.black) : showGlobalClock);
  const showWhiteClock = showAllInfo || tokenHas(playerRequested, "w", "wc") ||
    (hasSideFilters ? hasClock(sideRequested.white) : showGlobalClock);
  const showBlackPlayer = showAllInfo || tokenHas(playerRequested, "b", "bn") ||
    (hasSideFilters ? hasPlayer(sideRequested.black) : showGlobalPlayer);
  const showWhitePlayer = showAllInfo || tokenHas(playerRequested, "w", "wn") ||
    (hasSideFilters ? hasPlayer(sideRequested.white) : showGlobalPlayer);
  const showBlackIndex = showAllInfo || tokenHas(playerRequested, "b", "bi") ||
    (hasSideFilters ? hasIndex(sideRequested.black) : showGlobalIndex);
  const showWhiteIndex = showAllInfo || tokenHas(playerRequested, "w", "wi") ||
    (hasSideFilters ? hasIndex(sideRequested.white) : showGlobalIndex);
  const showBlackPoints = tokenHas(territoryRequested, "bp") ||
    tokenHas(areaRequested, "b") ||
    (hasSideFilters && hasPoints(sideRequested.black));
  const showWhitePoints = tokenHas(territoryRequested, "wp") ||
    tokenHas(areaRequested, "w") ||
    (hasSideFilters && hasPoints(sideRequested.white));
  const showBlackInfluence = tokenHas(territoryRequested, "bi");
  const showWhiteInfluence = tokenHas(territoryRequested, "wi");
  const showUnclaimedPoints = tokenHas(areaRequested, "u") ||
    (showArea && areaRequested.size === 0);
  const showScoreBar = tokenHas(territoryRequested, "bar") ||
    tokenHas(areaRequested, "bar") ||
    (showScore && territoryRequested.size === 0 && areaRequested.size === 0);
  const showBlackWinrate = tokenHas(evalRequested, "b") ||
    (hasSideFilters && hasWinrate(sideRequested.black));
  const showWhiteWinrate = tokenHas(evalRequested, "w") ||
    (hasSideFilters && hasWinrate(sideRequested.white));
  const showEvalBar = tokenHas(evalRequested, "bar") ||
    (showEval && evalRequested.size === 0);

  const showInfo = showBlackClock || showWhiteClock || showBlackPlayer ||
    showWhitePlayer || showPie || showLegend || showBlackWinrate ||
    showWhiteWinrate || showAllInfo;
  const showAnyIndex = showBlackIndex || showWhiteIndex;
  const showAllScoreLabels = showScore && territoryRequested.size === 0 &&
    areaRequested.size === 0 && !hasSideFilters;
  const showAllEval = showEval && evalRequested.size === 0 && !hasSideFilters;

  const hiddenSelectors = [
    !showBoard && ".goboard",
    !(showScore || showBlackPoints || showWhitePoints || showBlackInfluence ||
      showWhiteInfluence) && ".counting",
    !(showEval || showBlackWinrate || showWhiteWinrate || showEvalBar) &&
    ".winrate-bar-section",
    !showStatus && ".game-status",
    (!showResult || showBoard) && ".result-modal",
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
    (showScore || showBlackPoints || showWhitePoints || showBlackInfluence ||
      showWhiteInfluence) &&
    !(showAllScoreLabels || showBlackPoints) && "#black-points",
    (showScore || showBlackPoints || showWhitePoints || showBlackInfluence ||
      showWhiteInfluence) &&
    !(showAllScoreLabels || showWhitePoints) && "#white-points",
    (showScore || showBlackPoints || showWhitePoints || showBlackInfluence ||
      showWhiteInfluence) &&
    !(showAllScoreLabels || showBlackInfluence) && "#black-influence",
    (showScore || showBlackPoints || showWhitePoints || showBlackInfluence ||
      showWhiteInfluence) &&
    !(showAllScoreLabels || showWhiteInfluence) && "#white-influence",
    (showScore || showBlackPoints || showWhitePoints || showBlackInfluence ||
      showWhiteInfluence) &&
    !(showAllScoreLabels || showUnclaimedPoints) &&
    !(showAllScoreLabels || showScoreBar) &&
    "#unclaimed-points, #confidence-bar",
    (showScore || showBlackPoints || showWhitePoints || showBlackInfluence ||
      showWhiteInfluence) &&
    !(showAllScoreLabels || showUnclaimedPoints) &&
    (showAllScoreLabels || showScoreBar) && "#unclaimed-points",
    (showScore || showBlackPoints || showWhitePoints || showBlackInfluence ||
      showWhiteInfluence) &&
    (showAllScoreLabels || showUnclaimedPoints) &&
    !(showAllScoreLabels || showScoreBar) && "#confidence-bar",
    (showEval || showBlackWinrate || showWhiteWinrate || showEvalBar) &&
    !(showAllEval || showBlackWinrate) && "#winrate-bar-black-label",
    (showEval || showBlackWinrate || showWhiteWinrate || showEvalBar) &&
    !(showAllEval || showWhiteWinrate) && "#winrate-bar-white-label",
    (showEval || showBlackWinrate || showWhiteWinrate || showEvalBar) &&
    !(showAllEval || showEvalBar) && "#winrate-bar",
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
  const compactCss = requested.size > 0 || hasSideFilters || hasShortParams
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
