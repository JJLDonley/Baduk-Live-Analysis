import {
  GameContext,
  GameStateSnapshot,
  MoveQualityState,
  MoveQualityTracker,
} from "./models.ts";

export interface SessionState {
  context: { type: "game" | "review"; id: string };
  gameState: GameStateSnapshot | null;
  moveQuality: MoveQualityState;
  latestAnalysis: unknown | null;
}

export class SessionStore {
  private gameStates = new Map<string, GameStateSnapshot>();
  private qualityTrackers = new Map<string, MoveQualityTracker>();
  private latestAnalyses = new Map<string, unknown>();

  setGameState(context: GameContext, state: GameStateSnapshot): void {
    this.gameStates.set(context.key(), state);
  }

  getGameState(context: GameContext): GameStateSnapshot | null {
    return this.gameStates.get(context.key()) ?? null;
  }

  setLatestAnalysis(context: GameContext, analysis: unknown): void {
    this.latestAnalyses.set(context.key(), analysis);
  }

  getLatestAnalysis(context: GameContext): unknown | null {
    return this.latestAnalyses.get(context.key()) ?? null;
  }

  getMoveQualityTracker(context: GameContext): MoveQualityTracker {
    const key = context.key();
    let tracker = this.qualityTrackers.get(key);
    if (!tracker) {
      tracker = new MoveQualityTracker();
      this.qualityTrackers.set(key, tracker);
    }
    return tracker;
  }

  setMoveQualityTracker(
    context: GameContext,
    tracker: MoveQualityTracker,
  ): void {
    this.qualityTrackers.set(context.key(), tracker);
  }

  getSessionState(context: GameContext): SessionState {
    return {
      context: context.toJSON(),
      gameState: this.getGameState(context),
      moveQuality: this.getMoveQualityTracker(context).getState(),
      latestAnalysis: this.getLatestAnalysis(context),
    };
  }

  delete(context: GameContext): void {
    const key = context.key();
    this.gameStates.delete(key);
    this.qualityTrackers.delete(key);
    this.latestAnalyses.delete(key);
  }

  clear(): void {
    this.gameStates.clear();
    this.qualityTrackers.clear();
    this.latestAnalyses.clear();
  }
}
