import { replayMoves } from "./board-state.ts";
import { GameContext, GameStateSnapshot, Move, PlayerColor } from "./models.ts";

function isPlayerColor(value: unknown): value is PlayerColor {
  return value === "black" || value === "white";
}

function normalizeCoordinates(value: unknown): [number, number] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [x, y] = value;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return [x, y];
}

export function normalizeMoves(value: unknown): Move[] | null {
  if (!Array.isArray(value)) return null;
  const moves: Move[] = [];

  for (let index = 0; index < value.length; index++) {
    const raw = value[index];
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const color = record.color;
    const move = record.move;
    if (!isPlayerColor(color) || typeof move !== "string") return null;

    moves.push({
      moveNumber: Number.isInteger(record.moveNumber)
        ? record.moveNumber as number
        : index + 1,
      color,
      move,
      coordinates: normalizeCoordinates(record.coordinates),
    });
  }

  return moves;
}

export function normalizeGameStateSnapshot(
  context: GameContext,
  payload: unknown,
): GameStateSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const moves = normalizeMoves(record.moves);
  if (!moves) return null;

  const boardSize = Number.isInteger(record.boardSize) &&
      (record.boardSize as number) > 0
    ? record.boardSize as number
    : 19;

  const initialStones = Array.isArray(record.initialStones)
    ? record.initialStones.filter((stone): stone is [PlayerColor, string] =>
      Array.isArray(stone) && isPlayerColor(stone[0]) &&
      typeof stone[1] === "string"
    )
    : undefined;

  const replay = replayMoves(moves, boardSize);
  const capturesRecord = record.captures as Record<string, unknown> | undefined;
  const captures = capturesRecord &&
      Number.isFinite(capturesRecord.black) &&
      Number.isFinite(capturesRecord.white)
    ? {
      black: Number(capturesRecord.black),
      white: Number(capturesRecord.white),
    }
    : replay.captures;

  return {
    id: String(record.id ?? context.id),
    context: context.toJSON(),
    moves,
    currentPlayer: isPlayerColor(record.currentPlayer)
      ? record.currentPlayer
      : undefined,
    boardSize,
    rules: typeof record.rules === "string" ? record.rules : undefined,
    komi: Number.isFinite(record.komi) ? Number(record.komi) : undefined,
    initialStones,
    captures,
    board: replay.board,
    boardErrors: replay.errors,
    updatedAt: Date.now(),
  };
}
