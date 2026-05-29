import { classifyMoveQuality, MoveQuality, PlayerColor } from "./models.ts";

export interface KataGoMoveInfo {
  move?: string;
  scoreLead?: number;
  winrate?: number;
}

export interface KataGoAnalysisLike {
  moveInfos?: KataGoMoveInfo[];
  rootInfo?: {
    scoreLead?: number;
    winrate?: number;
  };
}

export interface MoveQualityInput {
  moveNumber: number;
  color: PlayerColor;
  move: string;
  previousAnalysis?: KataGoAnalysisLike;
  currentAnalysis?: KataGoAnalysisLike;
}

export function normalizeKataGoMove(move: unknown): string {
  if (Array.isArray(move)) {
    return `${move[0]},${move[1]}`;
  }
  return String(move).trim().toUpperCase();
}

export function calculateMoveQuality(
  input: MoveQualityInput,
): MoveQuality | undefined {
  const previousAnalysis = input.previousAnalysis;
  if (!previousAnalysis?.moveInfos?.length) return undefined;

  const normalizedMove = normalizeKataGoMove(input.move);
  const bestMove = previousAnalysis.moveInfos[0];
  const playedMove = previousAnalysis.moveInfos.find((info) =>
    normalizeKataGoMove(info.move) === normalizedMove
  );
  const isBestMove = normalizeKataGoMove(bestMove?.move) === normalizedMove;

  const bestWinrate = Number(bestMove?.winrate);
  const playedWinrate = Number(
    playedMove?.winrate ?? input.currentAnalysis?.rootInfo?.winrate,
  );

  if (!Number.isFinite(bestWinrate) || !Number.isFinite(playedWinrate)) {
    return undefined;
  }

  // KataGo winrate is black-perspective. Loss is percentage points from the
  // player who made the move, matching the frontend move-quality pie colors.
  const rawLoss = input.color === "black"
    ? bestWinrate - playedWinrate
    : playedWinrate - bestWinrate;
  const scoreLoss = Math.max(0, rawLoss * 100);

  return {
    moveNumber: input.moveNumber,
    move: input.move,
    color: input.color,
    scoreLoss,
    quality: classifyMoveQuality(scoreLoss, isBestMove),
  };
}
