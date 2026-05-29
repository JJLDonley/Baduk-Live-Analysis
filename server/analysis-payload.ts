import { GameContext, GameStateSnapshot } from "./models.ts";

export interface AnalysisCommandPayload {
  id?: string;
  moveNumber?: number;
  includePolicy?: boolean;
  includeOwnership?: boolean;
  maxVisits?: number;
}

export interface KataGoAnalysisPayload {
  id: string;
  context: { type: "game" | "review"; id: string };
  moves: [string, string][];
  initialStones: [string, string][];
  rules: string;
  komi: number;
  boardXSize: number;
  boardYSize: number;
  includePolicy: boolean;
  includeOwnership: boolean;
  maxVisits: number;
}

export function buildAnalysisPayloadFromSnapshot(
  context: GameContext,
  snapshot: GameStateSnapshot,
  payload: AnalysisCommandPayload,
  defaultMaxVisits: number,
): KataGoAnalysisPayload {
  const moveNumber = Number.isInteger(payload.moveNumber) &&
      (payload.moveNumber as number) >= 0
    ? payload.moveNumber as number
    : snapshot.moves.length;
  const clampedMoveNumber = Math.min(moveNumber, snapshot.moves.length);

  return {
    id: typeof payload.id === "string"
      ? payload.id
      : getMoveQueryId(context, clampedMoveNumber),
    context: context.toJSON(),
    moves: snapshot.moves.slice(0, clampedMoveNumber).map((move) => [
      move.color,
      move.move === "pass" ? "pass" : move.move,
    ]),
    initialStones: snapshot.initialStones ?? [],
    rules: snapshot.rules ?? "japanese",
    komi: snapshot.komi ?? 6.5,
    boardXSize: snapshot.boardSize,
    boardYSize: snapshot.boardSize,
    includePolicy: Boolean(payload.includePolicy),
    includeOwnership: payload.includeOwnership !== false,
    maxVisits: Number.isFinite(payload.maxVisits)
      ? Number(payload.maxVisits)
      : defaultMaxVisits,
  };
}

function getMoveQueryId(context: GameContext, moveNumber: number): string {
  const safeType = context.type.replace(/[^A-Za-z0-9-]/g, "_");
  const safeId = context.id.replace(/[^A-Za-z0-9-]/g, "_");
  return `${safeType}_${safeId}_move_${moveNumber}`;
}
