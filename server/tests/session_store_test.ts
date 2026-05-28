import { assertEquals } from "@std/assert";
import { SessionStore } from "../session-store.ts";
import { GameContext, GameStateSnapshot } from "../models.ts";

function snapshot(id: string): GameStateSnapshot {
  return {
    id,
    context: { type: "game", id },
    moves: [],
    boardSize: 19,
    updatedAt: 1,
  };
}

Deno.test("SessionStore stores game state per context", () => {
  const store = new SessionStore();
  const context = new GameContext("game", "1");
  store.setGameState(context, snapshot("1"));

  assertEquals(store.getGameState(context)?.id, "1");
});

Deno.test("SessionStore creates persistent move quality trackers", () => {
  const store = new SessionStore();
  const context = new GameContext("review", "r1");
  const tracker = store.getMoveQualityTracker(context);
  tracker.record({
    moveNumber: 1,
    color: "black",
    move: "D4",
    scoreLoss: 0.1,
    quality: "blue",
  });

  assertEquals(
    store.getMoveQualityTracker(context).getState().summary.black.blue,
    1,
  );
});

Deno.test("SessionStore exposes combined session state", () => {
  const store = new SessionStore();
  const context = new GameContext("game", "2");
  store.setGameState(context, snapshot("2"));

  const state = store.getSessionState(context);
  assertEquals(state.context, { type: "game", id: "2" });
  assertEquals(state.gameState?.id, "2");
  assertEquals(state.moveQuality.summary.black.total, 0);
});
