import { classifyMoveQuality, MoveQuality, PlayerColor } from "./models.ts";

export interface KataGoMoveInfo {
  move?: string;
  scoreLead?: number;
}

export interface KataGoAnalysisLike {
  moveInfos?: KataGoMoveInfo[];
  rootInfo?: {
    scoreLead?: number;
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

export function calculateMoveQuality(input: MoveQualityInput): MoveQuality {
  const unknown = (): MoveQuality => ({
    moveNumber: input.moveNumber,
    move: input.move,
    color: input.color,
    scoreLoss: null,
    quality: "unknown",
  });

  const previousAnalysis = input.previousAnalysis;
  if (!previousAnalysis?.moveInfos?.length) return unknown();

  const normalizedMove = normalizeKataGoMove(input.move);
  const bestMove = previousAnalysis.moveInfos[0];
  const playedMove = previousAnalysis.moveInfos.find((info) =>
    normalizeKataGoMove(info.move) === normalizedMove
  );

  const bestScore = Number(bestMove?.scoreLead);
  const playedScore = Number(
    playedMove?.scoreLead ?? input.currentAnalysis?.rootInfo?.scoreLead,
  );

  if (!Number.isFinite(bestScore) || !Number.isFinite(playedScore)) {
    return unknown();
  }

  // KataGo scoreLead is black-perspective in analysis mode. Loss is from the
  // player who made the move relative to the best available move before it.
  const rawLoss = input.color === "black"
    ? bestScore - playedScore
    : playedScore - bestScore;
  const scoreLoss = Math.max(0, rawLoss);

  return {
    moveNumber: input.moveNumber,
    move: input.move,
    color: input.color,
    scoreLoss,
    quality: classifyMoveQuality(scoreLoss),
  };
}
