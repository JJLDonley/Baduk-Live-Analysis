export type GameContextType = "game" | "review";
export type PlayerColor = "black" | "white";
export type MoveQualityColor = "blue" | "green" | "yellow" | "red" | "unknown";

export class GameContext {
  constructor(public type: GameContextType, public id: string) {}

  static fromUnknown(type: unknown, id: unknown): GameContext | null {
    if (
      (type !== "game" && type !== "review") || id === undefined ||
      id === null || String(id).trim() === ""
    ) {
      return null;
    }
    return new GameContext(type, String(id));
  }

  static fromRequestUrl(req: Request): GameContext | null {
    const url = new URL(req.url);
    return GameContext.fromUnknown(
      url.searchParams.get("type"),
      url.searchParams.get("id"),
    );
  }

  key(): string {
    return `${this.type}/${this.id}`;
  }

  toJSON(): { type: GameContextType; id: string } {
    return { type: this.type, id: this.id };
  }
}

export interface Move {
  moveNumber: number;
  color: PlayerColor;
  move: string;
  coordinates: [number, number] | null;
}

export interface GameStateSnapshot {
  id: string;
  context: { type: GameContextType; id: string };
  moves: Move[];
  currentPlayer?: PlayerColor;
  boardSize: number;
  rules?: string;
  komi?: number;
  initialStones?: [PlayerColor, string][];
  captures?: { black: number; white: number };
  board?: number[][];
  boardErrors?: string[];
  updatedAt: number;
}

export interface MoveQuality {
  moveNumber: number;
  move: string;
  color: PlayerColor;
  scoreLoss: number | null;
  quality: MoveQualityColor;
}

export interface QualityCounts {
  blue: number;
  green: number;
  yellow: number;
  red: number;
  unknown: number;
  total: number;
  averageScoreLoss: number | null;
}

export interface MoveQualitySummary {
  black: QualityCounts;
  white: QualityCounts;
}

export interface MoveQualityState {
  moves: MoveQuality[];
  summary: MoveQualitySummary;
}

export type ClientCommandName =
  | "connect-context"
  | "request-analysis"
  | "sync-state"
  | "get-state"
  | "set-analysis-settings";

export interface ClientCommand<TPayload = unknown> {
  type: "command";
  command: ClientCommandName;
  context?: { type: GameContextType; id: string };
  payload?: TPayload;
  requestId?: string;
}

export interface ServerEvent<TPayload = unknown> {
  type: "event";
  event: string;
  context?: { type: GameContextType; id: string };
  payload?: TPayload;
  requestId?: string;
  timestamp: number;
}

export function classifyMoveQuality(
  scoreLoss: number | null,
): MoveQualityColor {
  if (scoreLoss === null || !Number.isFinite(scoreLoss)) return "unknown";
  if (scoreLoss < 0.5) return "blue";
  if (scoreLoss < 1.5) return "green";
  if (scoreLoss < 3) return "yellow";
  return "red";
}

function createQualityCounts(): QualityCounts {
  return {
    blue: 0,
    green: 0,
    yellow: 0,
    red: 0,
    unknown: 0,
    total: 0,
    averageScoreLoss: null,
  };
}

export function createMoveQualitySummary(): MoveQualitySummary {
  return {
    black: createQualityCounts(),
    white: createQualityCounts(),
  };
}

export class MoveQualityTracker {
  private byMoveNumber = new Map<number, MoveQuality>();

  record(moveQuality: MoveQuality): MoveQualityState {
    this.byMoveNumber.set(moveQuality.moveNumber, moveQuality);
    return this.getState();
  }

  getState(): MoveQualityState {
    const moves = [...this.byMoveNumber.values()].sort((a, b) =>
      a.moveNumber - b.moveNumber
    );
    const summary = createMoveQualitySummary();
    const scoreTotals: Record<PlayerColor, { sum: number; count: number }> = {
      black: { sum: 0, count: 0 },
      white: { sum: 0, count: 0 },
    };

    for (const move of moves) {
      const counts = summary[move.color];
      counts[move.quality]++;
      counts.total++;
      if (move.scoreLoss !== null && Number.isFinite(move.scoreLoss)) {
        scoreTotals[move.color].sum += move.scoreLoss;
        scoreTotals[move.color].count++;
      }
    }

    for (const color of ["black", "white"] as const) {
      const totals = scoreTotals[color];
      summary[color].averageScoreLoss = totals.count > 0
        ? totals.sum / totals.count
        : null;
    }

    return { moves, summary };
  }
}

export function parseClientCommand(data: unknown): ClientCommand | null {
  if (!data || typeof data !== "object") return null;
  const value = data as Record<string, unknown>;
  if (value.type !== "command") return null;
  if (typeof value.command !== "string") return null;
  const validCommands: ClientCommandName[] = [
    "connect-context",
    "request-analysis",
    "sync-state",
    "get-state",
    "set-analysis-settings",
  ];
  if (!validCommands.includes(value.command as ClientCommandName)) return null;

  const contextValue = value.context as Record<string, unknown> | undefined;
  const context = contextValue
    ? GameContext.fromUnknown(contextValue.type, contextValue.id)?.toJSON()
    : undefined;
  if (contextValue && !context) return null;

  return {
    type: "command",
    command: value.command as ClientCommandName,
    context,
    payload: value.payload,
    requestId: typeof value.requestId === "string"
      ? value.requestId
      : undefined,
  };
}
