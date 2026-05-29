import { AIChildProcess } from "./ai.ts";
import { ArgumentParser, ConfigManager, ServerConfig } from "./config.ts";
import {
  ogsStringToVertex,
  PatternMatchingService,
  PatternMatchRequest,
} from "./pattern.ts";
import { AnalysisCache } from "./analysis-cache.ts";
import { buildAnalysisPayloadFromSnapshot } from "./analysis-payload.ts";
import {
  AnalysisSettings,
  mergeAnalysisSettings,
  normalizeAnalysisSettings,
} from "./analysis-settings.ts";
import { replayMoves } from "./board-state.ts";
import { normalizeGameStateSnapshot } from "./game-state.ts";
import { calculateMoveQuality } from "./move-quality.ts";
import { SessionStore } from "./session-store.ts";
import {
  GameContext,
  GameContextType,
  MoveQuality,
  MoveQualityState,
  MoveQualityTracker,
  parseClientCommand,
} from "./models.ts";

interface AnalysisRequest {
  id: string;
  context: GameContext;
  moves: [string, string][];
  initialStones: [string, string][];
  rules: string;
  komi: number;
  boardXSize: number;
  boardYSize: number;
  includePolicy: boolean;
  includeOwnership: boolean;
  maxVisits: number;
  cacheKey?: string;
}

interface AnalysisResponse {
  id: string;
  context?: { type: GameContextType; id: string };
  analysis?: any;
  playerMoveQuality?: MoveQuality;
  moveQuality?: MoveQualityState;
  error?: string;
  timestamp: number;
}

interface PendingAnalysisSubscriber {
  id: string;
  commandMode: boolean;
}

class AnalysisServer {
  private config: ServerConfig;
  private configManager: ConfigManager;
  private katago: AIChildProcess | null = null;
  private patternMatcher: PatternMatchingService;
  private analysisQueue: AnalysisRequest[] = [];
  private processingAnalysis = false;
  private websocketConnections: Set<WebSocket> = new Set();
  private socketContexts: WeakMap<WebSocket, GameContext> = new WeakMap();
  private socketAnalysisSettings: WeakMap<WebSocket, AnalysisSettings> =
    new WeakMap();
  private analysisCache = new AnalysisCache<AnalysisResponse>(1000);
  private pendingAnalysisSockets: Map<
    string,
    Map<WebSocket, PendingAnalysisSubscriber>
  > = new Map();
  private sessions = new SessionStore();
  private qualitySignatures = new Map<string, string>();
  private qualityLines = new Map<
    string,
    { settingsSignature: string; moves: [string, string][] }
  >();
  private pendingQualityFrames = new Map<
    string,
    {
      signature: string;
      tracker: MoveQualityTracker;
      targetMoveCount: number;
      startMoveCount: number;
      targetRequest: AnalysisRequest;
    }
  >();
  private serverStartTime: number;

  constructor(config: ServerConfig, configManager: ConfigManager) {
    this.config = config;
    this.configManager = configManager;
    this.patternMatcher = new PatternMatchingService();
    this.serverStartTime = Date.now();
  }

  public async start(): Promise<void> {
    try {
      // Initialize KataGo
      await this.initializeKataGo();

      // Start WebSocket server
      this.startWebSocketServer();

      console.log(
        `[Server] Baduk Live Analysis Server started on ${this.config.host}:${this.config.port}`,
      );
      console.log(`[Server] KataGo ready for analysis`);
    } catch (error) {
      console.error(`[Server] Failed to start server:`, error);
      throw error;
    }
  }

  private async initializeKataGo(): Promise<void> {
    const executablePath = this.configManager.getKataGoExecutablePath();
    const modelPath = this.configManager.getKataGoModelPath();
    const configPath = this.configManager.getKataGoConfigPath();

    console.log(`[KataGo] Starting KataGo process...`);
    console.log(`[KataGo] Executable: ${executablePath}`);
    console.log(`[KataGo] Model: ${modelPath}`);
    console.log(`[KataGo] Config: ${configPath}`);

    const args = [
      "analysis",
      "-config",
      configPath,
      "-model",
      modelPath,
    ];

    this.katago = new AIChildProcess(executablePath, args);

    // Initialize KataGo with a dummy query to ensure it's ready
    await this.initializeKataGoEngine();

    // Start processing analysis queue
    this.processAnalysisQueue();
  }

  private async initializeKataGoEngine(): Promise<void> {
    if (!this.katago) {
      throw new Error("KataGo process not initialized");
    }

    // Send initial query to KataGo
    const initQuery = {
      id: "init",
      initialStones: [],
      moves: [],
      rules: this.config.analysis.includePolicy ? "japanese" : "chinese",
      komi: 6.5,
      boardXSize: 19,
      boardYSize: 19,
      includePolicy: this.config.analysis.includePolicy,
      includeOwnership: this.config.analysis.includeOwnership,
      maxVisits: 1,
    };

    await this.katago.query(initQuery);
    console.log(`[KataGo] Engine initialized successfully`);
  }

  private startWebSocketServer(): void {
    Deno.serve({
      port: this.config.port,
      hostname: this.config.host,
      onError: (error) => {
        console.error(`[Server] Request error:`, error);
        return new Response("Internal Server Error", { status: 500 });
      },
    }, (req) => {
      return this.handleRequest(req);
    });

    console.log(
      `[Server] WebSocket server listening on ws://${this.config.host}:${this.config.port}`,
    );
  }

  private handleRequest(req: Request): Response {
    const upgrade = req.headers.get("upgrade") ?? "";
    if (upgrade.toLowerCase() !== "websocket") {
      // Browsers, health checks, or port scanners may hit this HTTP endpoint.
      // Do not try to upgrade those requests and spam logs.
      return new Response(
        "Baduk AI analysis WebSocket server is running on port 8081.\n" +
          "This port is not the game UI. Start the frontend and open http://localhost:8080/game/<OGS_GAME_ID>\n",
        {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        },
      );
    }

    return this.handleWebSocketConnection(req);
  }

  private handleWebSocketConnection(req: Request): Response {
    let socket: WebSocket;
    let response: Response;

    try {
      ({ socket, response } = Deno.upgradeWebSocket(req));
    } catch {
      // Malformed WebSocket upgrade request. Ignore quietly.
      return new Response("Invalid WebSocket upgrade request\n", {
        status: 400,
      });
    }

    const urlContext = GameContext.fromRequestUrl(req);

    socket.onopen = () => {
      console.log(
        `[WebSocket] Client connected${
          urlContext ? ` for ${urlContext.key()}` : ""
        }`,
      );
      this.websocketConnections.add(socket);
      if (urlContext) {
        this.socketContexts.set(socket, urlContext);
        this.sendServerEvent(
          socket,
          "state",
          urlContext,
          this.sessions.getSessionState(urlContext),
          `state/${urlContext.key()}`,
        );
      }
    };

    socket.onmessage = (event) => {
      this.handleAnalysisRequest(socket, event.data);
    };

    socket.onclose = () => {
      console.log(`[WebSocket] Client disconnected`);
      this.websocketConnections.delete(socket);
    };

    socket.onerror = (error) => {
      console.error(`[WebSocket] Connection error:`, error);
      this.websocketConnections.delete(socket);
    };

    return response;
  }

  private handleAnalysisRequest(
    socket: WebSocket,
    data: string,
  ): void {
    try {
      const request = JSON.parse(data);

      const command = parseClientCommand(request);
      if (command) {
        this.handleClientCommand(socket, command);
        return;
      }

      // Check if this is a pattern matching request
      if (request.type === "pattern-match") {
        this.handlePatternMatchRequest(socket, request);
        return;
      }

      this.enqueueAnalysisFromPayload(socket, request, undefined, false);
    } catch (error) {
      console.error(`[Analysis] Error parsing request:`, error);
      this.sendError(socket, "Invalid JSON in analysis request");
    }
  }

  private enqueueAnalysisFromPayload(
    socket: WebSocket,
    payload: Record<string, unknown>,
    explicitContext?: GameContext,
    commandMode = false,
  ): void {
    const socketContext = this.socketContexts.get(socket);
    const requestContext = explicitContext ?? GameContext.fromUnknown(
      (payload.context as Record<string, unknown> | undefined)?.type ??
        payload.gameType,
      (payload.context as Record<string, unknown> | undefined)?.id ??
        payload.gameId,
    );
    const context = requestContext ?? socketContext;
    if (!context) {
      this.sendError(
        socket,
        "Analysis requests must include a game/review context",
      );
      return;
    }
    if (socketContext && socketContext.key() !== context.key()) {
      this.sendError(
        socket,
        `Socket is connected to ${socketContext.key()}, not ${context.key()}`,
      );
      return;
    }
    this.socketContexts.set(socket, context);

    const analysisRequest = {
      ...payload,
      context,
    } as unknown as AnalysisRequest;
    if (!analysisRequest.id || !Array.isArray(analysisRequest.moves)) {
      this.sendError(socket, "Invalid analysis request format");
      return;
    }

    analysisRequest.maxVisits = Math.min(
      analysisRequest.maxVisits || this.config.analysis.maxVisits,
      this.config.analysis.maxVisits,
    );
    analysisRequest.includePolicy = analysisRequest.includePolicy &&
      this.config.analysis.includePolicy;
    analysisRequest.includeOwnership = analysisRequest.includeOwnership &&
      this.config.analysis.includeOwnership;

    console.log(
      `[Analysis] Received request ${analysisRequest.id} for ${context.key()} with ${analysisRequest.moves.length} moves`,
    );

    this.prepareQualityFrame(analysisRequest);
    const cacheKey = this.getAnalysisCacheKey(analysisRequest);
    const cachedResponse = this.analysisCache.get(cacheKey);
    const qualityKnown = analysisRequest.moves.length === 0 ||
      this.hasKnownMoveQuality(analysisRequest, analysisRequest.moves.length);

    if (
      cachedResponse && qualityKnown &&
      !this.getQualityFrame(analysisRequest.context)
    ) {
      const responseForSocket = {
        ...cachedResponse,
        id: analysisRequest.id,
        timestamp: Date.now(),
      };
      this.sessions.setLatestAnalysis(context, responseForSocket);
      if (commandMode) {
        this.sendServerEvent(
          socket,
          "analysis-completed",
          context,
          responseForSocket,
          analysisRequest.id,
        );
        this.sendServerEvent(
          socket,
          "move-quality-updated",
          context,
          responseForSocket.moveQuality,
          analysisRequest.id,
        );
      } else {
        this.sendAnalysisResponse(socket, responseForSocket);
      }
      return;
    }

    // Prioritize the current board position for live UI updates. Then backfill
    // any missing prefix analyses needed for move-quality classification. If the
    // current move's previous-position analysis is missing, its cached current
    // analysis is classified once backfill reaches that dependency.
    this.queueAnalysisRequest(
      analysisRequest,
      new Map([[socket, { id: analysisRequest.id, commandMode }]]),
      true,
    );
    this.enqueueMissingMoveAnalyses(analysisRequest);

    if (!this.processingAnalysis) {
      this.processAnalysisQueue();
    }
  }

  private queueAnalysisRequest(
    request: AnalysisRequest,
    subscribers = new Map<WebSocket, PendingAnalysisSubscriber>(),
    force = false,
  ): boolean {
    const cacheKey = request.cacheKey ?? this.getAnalysisCacheKey(request);
    const pendingSockets = this.pendingAnalysisSockets.get(cacheKey);
    if (pendingSockets) {
      subscribers.forEach((subscriber, socket) => {
        pendingSockets.set(socket, subscriber);
      });
      return false;
    }

    if (!force && this.analysisCache.get(cacheKey)) {
      return false;
    }

    this.pendingAnalysisSockets.set(cacheKey, subscribers);
    request.cacheKey = cacheKey;
    if (force) {
      this.analysisQueue.unshift(request);
    } else {
      this.analysisQueue.push(request);
    }
    return true;
  }

  private enqueueMissingMoveAnalyses(request: AnalysisRequest): boolean {
    let queued = false;
    for (let moveCount = 0; moveCount < request.moves.length; moveCount++) {
      const prefixRequest = this.createPrefixAnalysisRequest(
        request,
        moveCount,
      );
      const cacheKey = this.getAnalysisCacheKey(prefixRequest);
      const cachedResponse = this.analysisCache.get(cacheKey);

      if (cachedResponse) {
        this.recordMoveQualityFromCachedAnalysis(prefixRequest, cachedResponse);
        continue;
      }

      queued = this.queueAnalysisRequest(prefixRequest) || queued;
    }
    return queued;
  }

  private createPrefixAnalysisRequest(
    request: AnalysisRequest,
    moveCount: number,
  ): AnalysisRequest {
    return {
      ...request,
      id: `${request.id}/backfill/${moveCount}`,
      moves: request.moves.slice(0, moveCount),
      cacheKey: undefined,
    };
  }

  private hasKnownMoveQuality(
    request: AnalysisRequest,
    moveNumber: number,
  ): boolean {
    return this.getQualityTrackerForRequest(request).getState().moves.some(
      (move) => move.moveNumber === moveNumber,
    );
  }

  private recordMoveQualityFromCachedAnalysis(
    request: AnalysisRequest,
    response: AnalysisResponse,
  ): boolean {
    if (request.moves.length === 0 || !response.analysis) return false;
    if (this.hasKnownMoveQuality(request, request.moves.length)) {
      return true;
    }

    const playerMoveQuality = this.calculatePlayerMoveQuality(
      request,
      response.analysis,
    );
    if (!playerMoveQuality) {
      return false;
    }

    const tracker = this.getQualityTrackerForRequest(request);
    response.playerMoveQuality = playerMoveQuality;
    response.moveQuality = tracker.record(playerMoveQuality);
    return true;
  }

  private prepareQualityFrame(request: AnalysisRequest): void {
    const key = request.context.key();
    const signature = this.getMoveLineSignature(request);
    if (this.qualitySignatures.get(key) === signature) return;

    const existing = this.pendingQualityFrames.get(key);
    if (existing) {
      if (existing.signature === signature) return;
      existing.signature = signature;
      existing.targetMoveCount = request.moves.length;
      existing.targetRequest = request;
      existing.startMoveCount = Math.min(
        existing.startMoveCount,
        request.moves.length,
      );
      return;
    }

    const settingsSignature = this.getMoveLineSettingsSignature(request);
    const previousLine = this.qualityLines.get(key);
    if (
      previousLine?.settingsSignature === settingsSignature &&
      this.isAppendOnlyMoveLine(previousLine.moves, request.moves)
    ) {
      this.pendingQualityFrames.set(key, {
        signature,
        tracker: this.sessions.getMoveQualityTracker(request.context),
        targetMoveCount: request.moves.length,
        startMoveCount: previousLine.moves.length,
        targetRequest: request,
      });
      return;
    }

    const firstChangedMoveIndex = previousLine
      ? this.getFirstMoveDifference(previousLine.moves, request.moves)
      : 0;
    const tracker = new MoveQualityTracker();
    for (
      const move of this.sessions.getMoveQualityTracker(request.context)
        .getState().moves
    ) {
      if (
        move.moveNumber <= request.moves.length &&
        move.moveNumber <= firstChangedMoveIndex
      ) {
        tracker.record(move);
      }
    }

    this.pendingQualityFrames.set(key, {
      signature,
      tracker,
      targetMoveCount: request.moves.length,
      startMoveCount: firstChangedMoveIndex,
      targetRequest: request,
    });
  }

  private getQualityFrame(context: GameContext) {
    return this.pendingQualityFrames.get(context.key());
  }

  private getQualityTrackerForRequest(
    request: AnalysisRequest,
  ): MoveQualityTracker {
    return this.getQualityFrame(request.context)?.tracker ??
      this.sessions.getMoveQualityTracker(request.context);
  }

  private getMoveLineSignature(request: AnalysisRequest): string {
    return JSON.stringify({
      moves: request.moves,
      settings: this.getMoveLineSettingsSignature(request),
    });
  }

  private getMoveLineSettingsSignature(request: AnalysisRequest): string {
    return JSON.stringify({
      initialStones: request.initialStones ?? [],
      rules: request.rules,
      komi: request.komi,
      boardXSize: request.boardXSize,
      boardYSize: request.boardYSize,
    });
  }

  private isAppendOnlyMoveLine(
    previousMoves: [string, string][],
    currentMoves: [string, string][],
  ): boolean {
    return currentMoves.length >= previousMoves.length &&
      this.getFirstMoveDifference(previousMoves, currentMoves) ===
        previousMoves.length;
  }

  private getFirstMoveDifference(
    previousMoves: [string, string][],
    currentMoves: [string, string][],
  ): number {
    const sharedLength = Math.min(previousMoves.length, currentMoves.length);
    for (let i = 0; i < sharedLength; i++) {
      if (
        previousMoves[i][0] !== currentMoves[i][0] ||
        previousMoves[i][1] !== currentMoves[i][1]
      ) {
        return i;
      }
    }
    return sharedLength;
  }

  private refreshCachedMoveQualityForFrame(context: GameContext): void {
    const frame = this.pendingQualityFrames.get(context.key());
    if (!frame) return;

    for (let moveCount = 1; moveCount <= frame.targetMoveCount; moveCount++) {
      const prefixRequest = this.createPrefixAnalysisRequest(
        frame.targetRequest,
        moveCount,
      );
      const cachedResponse = this.analysisCache.get(
        this.getAnalysisCacheKey(prefixRequest),
      );
      if (cachedResponse) {
        this.recordMoveQualityFromCachedAnalysis(prefixRequest, cachedResponse);
      }
    }
  }

  private commitQualityFrameIfComplete(
    request: AnalysisRequest,
    response: AnalysisResponse,
  ): AnalysisResponse {
    const key = request.context.key();
    const frame = this.pendingQualityFrames.get(key);
    if (!frame) return response;

    const qualityState = frame.tracker.getState();
    const complete = frame.targetMoveCount === 0 ||
      Array.from({ length: frame.targetMoveCount }, (_, index) => index + 1)
        .every((moveNumber) =>
          qualityState.moves.some((move) => move.moveNumber === moveNumber)
        );
    if (!complete) return { ...response, moveQuality: qualityState };

    this.sessions.setMoveQualityTracker(request.context, frame.tracker);
    this.qualitySignatures.set(key, frame.signature);
    this.qualityLines.set(key, {
      settingsSignature: this.getMoveLineSettingsSignature(frame.targetRequest),
      moves: frame.targetRequest.moves.map(([color, move]) => [color, move]),
    });
    this.pendingQualityFrames.delete(key);

    return {
      ...response,
      moveQuality: frame.tracker.getState(),
    };
  }

  private async processAnalysisQueue(): Promise<void> {
    if (this.processingAnalysis || this.analysisQueue.length === 0) {
      return;
    }

    this.processingAnalysis = true;

    while (this.analysisQueue.length > 0) {
      const request = this.analysisQueue.shift()!;

      try {
        await this.processAnalysisRequest(request);
      } catch (error) {
        console.error(
          `[Analysis] Error processing request ${request.id}:`,
          error,
        );
        const errorMessage = error instanceof Error
          ? error.message
          : String(error);
        const cacheKey = request.cacheKey ?? this.getAnalysisCacheKey(request);
        const sockets = this.pendingAnalysisSockets.get(cacheKey) ??
          new Map<WebSocket, PendingAnalysisSubscriber>();
        sockets.forEach((_subscriber, socket) =>
          this.sendError(socket, `Analysis failed: ${errorMessage}`)
        );
        this.pendingAnalysisSockets.delete(cacheKey);
      }

      // Small delay to prevent overwhelming KataGo
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.processingAnalysis = false;
  }

  private async processAnalysisRequest(
    request: AnalysisRequest,
  ): Promise<void> {
    if (!this.katago) {
      throw new Error("KataGo not initialized");
    }

    const cacheKey = request.cacheKey ?? this.getAnalysisCacheKey(request);
    const isBackfillRequest = request.id.includes("/backfill/");

    // Convert moves to KataGo format
    const katagoQuery = this.convertToKataGoFormat(request);

    console.log(
      `[Analysis] Processing ${request.id} with ${request.maxVisits} visits`,
    );

    const startTime = Date.now();
    const timeout = this.config.analysis.timeoutMs;

    try {
      const response = await this.katago.query(katagoQuery, timeout);

      const processingTime = Date.now() - startTime;
      console.log(`[Analysis] Completed ${request.id} in ${processingTime}ms`);

      // Parse and send response
      const analysisResult = JSON.parse(response);
      let analysisResponse: AnalysisResponse = {
        id: request.id,
        context: { type: request.context.type, id: request.context.id },
        analysis: analysisResult,
        playerMoveQuality: this.calculatePlayerMoveQuality(
          request,
          analysisResult,
        ),
        timestamp: Date.now(),
      };
      const tracker = this.getQualityTrackerForRequest(request);
      if (analysisResponse.playerMoveQuality) {
        analysisResponse.moveQuality = tracker.record(
          analysisResponse.playerMoveQuality,
        );
      } else {
        analysisResponse.moveQuality = tracker.getState();
      }
      this.analysisCache.set(cacheKey, analysisResponse);
      this.refreshCachedMoveQualityForFrame(request.context);
      const hadQualityFrame = this.pendingQualityFrames.has(
        request.context.key(),
      );
      analysisResponse = this.commitQualityFrameIfComplete(
        request,
        analysisResponse,
      );
      const completedQualityFrame = hadQualityFrame &&
        !this.pendingQualityFrames.has(request.context.key());
      this.analysisCache.set(cacheKey, analysisResponse);
      if (!isBackfillRequest) {
        this.sessions.setLatestAnalysis(request.context, analysisResponse);
      }

      const sockets = this.pendingAnalysisSockets.get(cacheKey) ??
        new Map<WebSocket, PendingAnalysisSubscriber>();
      sockets.forEach((subscriber, socket) => {
        const responseForSocket = { ...analysisResponse, id: subscriber.id };
        if (subscriber.commandMode) {
          this.sendServerEvent(
            socket,
            "analysis-completed",
            request.context,
            responseForSocket,
            subscriber.id,
          );
          if (responseForSocket.moveQuality) {
            this.sendServerEvent(
              socket,
              "move-quality-updated",
              request.context,
              responseForSocket.moveQuality,
              subscriber.id,
            );
          }
        } else {
          this.sendAnalysisResponse(socket, responseForSocket);
        }
      });
      this.pendingAnalysisSockets.delete(cacheKey);

      if (isBackfillRequest || completedQualityFrame) {
        this.broadcastMoveQualityUpdate(
          request.context,
          analysisResponse.moveQuality,
        );
      }

      // Process pattern matching for the latest move
      for (const socket of sockets.keys()) {
        this.processPatternMatchingForLatestMove(socket, request);
      }
    } catch (error) {
      console.error(`[Analysis] Request ${request.id} failed:`, error);
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      if (errorMessage.includes("Analysis timeout")) {
        await this.restartKataGoAfterFailure();
      }
      const sockets = this.pendingAnalysisSockets.get(cacheKey) ??
        new Map<WebSocket, PendingAnalysisSubscriber>();
      sockets.forEach((_subscriber, socket) =>
        this.sendError(socket, `Analysis failed: ${errorMessage}`)
      );
      this.pendingAnalysisSockets.delete(cacheKey);
    }
  }

  private async restartKataGoAfterFailure(): Promise<void> {
    console.warn("[KataGo] Restarting engine after analysis failure");
    try {
      if (this.katago) {
        this.katago.ProcessKill();
      }
    } catch (error) {
      console.error("[KataGo] Error killing failed process:", error);
    } finally {
      this.katago = null;
    }

    const executablePath = this.configManager.getKataGoExecutablePath();
    const modelPath = this.configManager.getKataGoModelPath();
    const configPath = this.configManager.getKataGoConfigPath();
    this.katago = new AIChildProcess(executablePath, [
      "analysis",
      "-config",
      configPath,
      "-model",
      modelPath,
    ]);
    await this.initializeKataGoEngine();
  }

  private processPatternMatchingForLatestMove(
    socket: WebSocket,
    request: AnalysisRequest,
  ): void {
    try {
      // Get the latest move from the request
      if (request.moves.length === 0) {
        console.log(
          `[PatternMatch] No moves to analyze for request ${request.id}`,
        );
        return;
      }

      const latestMove = request.moves[request.moves.length - 1];
      const [color, move] = latestMove;

      const sessionMove = this.sessions.getGameState(request.context)?.moves[
        request.moves.length - 1
      ];

      if (sessionMove?.move === "pass" || move === "pass") {
        this.sendPatternMatchResponse(socket, {
          type: "pattern-match",
          id: `${request.id}-pattern`,
          moveName: "Pass",
          pattern: null,
          match: null,
          timestamp: Date.now(),
        });
        console.log(`[PatternMatch] Latest move is pass for ${request.id}`);
        return;
      }

      // Prefer backend canonical coordinates from synced session state.
      let vertex: [number, number];
      if (sessionMove?.coordinates) {
        vertex = sessionMove.coordinates;
      } else if (typeof move === "string") {
        vertex = ogsStringToVertex(move);
      } else {
        vertex = move as [number, number];
      }

      // Determine sign based on color
      const sign = color === "black" ? 1 : -1;

      const session = this.sessions.getGameState(request.context);
      const boardData = session
        ? replayMoves(
          session.moves.slice(0, request.moves.length - 1),
          session.boardSize,
        ).board
        : this.buildBoardFromMoves(
          request.moves.slice(0, -1),
          request.boardXSize,
          request.boardYSize,
        );

      // Create pattern matching request
      const patternRequest: PatternMatchRequest = {
        id: `${request.id}-pattern`,
        boardData: boardData,
        sign: sign,
        vertex: vertex,
        boardSize: request.boardXSize,
      };

      // Get pattern match result
      const patternResult = this.patternMatcher.nameMove(patternRequest);

      // Send pattern match response
      const patternResponse = {
        type: "pattern-match",
        ...patternResult,
      };

      this.sendPatternMatchResponse(socket, patternResponse);

      console.log(
        `[PatternMatch] Sent pattern match for move ${move}: ${
          patternResult.moveName || "No pattern found"
        }`,
      );
    } catch (error) {
      console.error(`[PatternMatch] Error processing pattern matching:`, error);
      // Don't send error to client for pattern matching failures
    }
  }

  private buildBoardFromMoves(
    moves: [string, string][],
    boardXSize: number,
    boardYSize: number,
  ): number[][] {
    // Create board with proper dimensions
    const board = Array.from(
      { length: boardYSize },
      () => Array(boardXSize).fill(0),
    );

    for (const [moveColor, move] of moves) {
      let vertex: [number, number];

      if (typeof move === "string") {
        // Review format: "dd" -> [3, 3]
        vertex = ogsStringToVertex(move);
      } else {
        // Game format: already [x, y] array
        vertex = move as [number, number];
      }

      // Validate vertex bounds
      if (
        vertex[0] >= 0 && vertex[0] < boardXSize && vertex[1] >= 0 &&
        vertex[1] < boardYSize
      ) {
        const sign = moveColor === "black" ? 1 : -1;
        board[vertex[1]][vertex[0]] = sign;
      } else {
        console.warn(
          `[PatternMatch] Invalid vertex [${vertex[0]}, ${
            vertex[1]
          }] for board size ${boardXSize}x${boardYSize}`,
        );
      }
    }

    return board;
  }

  private getAnalysisCacheKey(request: AnalysisRequest): string {
    return JSON.stringify({
      context: request.context.key(),
      moves: request.moves,
      initialStones: request.initialStones ?? [],
      rules: request.rules,
      komi: request.komi,
      boardXSize: request.boardXSize,
      boardYSize: request.boardYSize,
      includePolicy: request.includePolicy,
      includeOwnership: request.includeOwnership,
      maxVisits: request.maxVisits,
    });
  }

  private calculatePlayerMoveQuality(
    request: AnalysisRequest,
    currentAnalysis: any,
  ): MoveQuality | undefined {
    if (request.moves.length === 0) return undefined;

    const [rawColor, move] = request.moves[request.moves.length - 1];
    const color = rawColor === "white" ? "white" : "black";
    const previousRequest: AnalysisRequest = {
      ...request,
      moves: request.moves.slice(0, -1),
    };
    const previousResponse = this.analysisCache.get(
      this.getAnalysisCacheKey(previousRequest),
    );

    return calculateMoveQuality({
      moveNumber: request.moves.length,
      move,
      color,
      previousAnalysis: previousResponse?.analysis,
      currentAnalysis,
    });
  }

  private convertToKataGoFormat(request: AnalysisRequest): any {
    return {
      id: request.id,
      initialStones: request.initialStones,
      moves: request.moves,
      rules: request.rules,
      komi: request.komi,
      boardXSize: request.boardXSize,
      boardYSize: request.boardYSize,
      includePolicy: request.includePolicy,
      includeOwnership: request.includeOwnership,
      maxVisits: request.maxVisits,
    };
  }

  private sendAnalysisResponse(
    socket: WebSocket,
    response: AnalysisResponse,
  ): void {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error(`[WebSocket] Error sending response:`, error);
    }
  }

  private sendError(socket: WebSocket, errorMessage: string): void {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          error: errorMessage,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.error(`[WebSocket] Error sending error:`, error);
    }
  }

  private broadcastMoveQualityUpdate(
    context: GameContext,
    moveQuality: MoveQualityState | undefined,
  ): void {
    if (!moveQuality) return;
    for (const socket of this.websocketConnections) {
      const socketContext = this.socketContexts.get(socket);
      if (socketContext?.key() === context.key()) {
        this.sendServerEvent(
          socket,
          "move-quality-updated",
          context,
          moveQuality,
        );
      }
    }
  }

  private handleClientCommand(
    socket: WebSocket,
    command: ReturnType<typeof parseClientCommand>,
  ): void {
    if (!command) return;

    const context = command.context
      ? GameContext.fromUnknown(command.context.type, command.context.id)
      : this.socketContexts.get(socket);
    if (command.command === "connect-context") {
      if (!context) {
        this.sendError(
          socket,
          "connect-context requires a valid game/review context",
        );
        return;
      }
      this.socketContexts.set(socket, context);
      this.sendServerEvent(
        socket,
        "context-connected",
        context,
        this.sessions.getSessionState(context),
        command.requestId,
      );
      return;
    }

    if (!context) {
      this.sendError(
        socket,
        `${command.command} requires a connected game/review context`,
      );
      return;
    }

    if (command.command === "get-state") {
      this.sendServerEvent(
        socket,
        "state",
        context,
        this.sessions.getSessionState(context),
        command.requestId,
      );
      return;
    }

    if (command.command === "sync-state") {
      const snapshot = normalizeGameStateSnapshot(context, command.payload);
      if (!snapshot) {
        this.sendError(
          socket,
          "sync-state requires a valid game state payload",
        );
        return;
      }
      this.sessions.setGameState(context, snapshot);
      this.sendServerEvent(
        socket,
        "state-synced",
        context,
        this.sessions.getSessionState(context),
        command.requestId,
      );
      return;
    }

    if (command.command === "request-analysis") {
      if (!command.payload || typeof command.payload !== "object") {
        this.sendError(socket, "request-analysis requires an analysis payload");
        return;
      }
      const payload = command.payload as Record<string, unknown>;
      const socketSettings = this.socketAnalysisSettings.get(socket) ?? {};
      const payloadSettings = normalizeAnalysisSettings(
        payload,
        this.config.analysis.maxVisits,
      ) ?? {};
      const effectiveSettings = mergeAnalysisSettings(
        socketSettings,
        payloadSettings,
      );
      const payloadWithSettings = { ...payload, ...effectiveSettings };
      const analysisPayload = Array.isArray(payload.moves)
        ? payloadWithSettings
        : this.buildAnalysisPayloadFromSession(context, payloadWithSettings);
      if (!analysisPayload) {
        this.sendError(
          socket,
          "No synced game state available for request-analysis",
        );
        return;
      }
      this.enqueueAnalysisFromPayload(
        socket,
        analysisPayload,
        context,
        true,
      );
      return;
    }

    if (command.command === "set-analysis-settings") {
      const settings = normalizeAnalysisSettings(
        command.payload,
        this.config.analysis.maxVisits,
      );
      if (!settings) {
        this.sendError(socket, "Invalid analysis settings payload");
        return;
      }
      const existing = this.socketAnalysisSettings.get(socket) ?? {};
      const merged = mergeAnalysisSettings(existing, settings);
      this.socketAnalysisSettings.set(socket, merged);
      this.sendServerEvent(
        socket,
        "analysis-settings-accepted",
        context,
        merged,
        command.requestId,
      );
      return;
    }

    this.sendError(socket, `${command.command} command is not implemented yet`);
  }

  private buildAnalysisPayloadFromSession(
    context: GameContext,
    payload: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const snapshot = this.sessions.getGameState(context);
    if (!snapshot) return null;
    return buildAnalysisPayloadFromSnapshot(
      context,
      snapshot,
      payload,
      this.config.analysis.maxVisits,
    ) as unknown as Record<string, unknown>;
  }

  private sendServerEvent(
    socket: WebSocket,
    event: string,
    context: GameContext,
    payload: unknown,
    requestId?: string,
  ): void {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "event",
          event,
          context: context.toJSON(),
          payload,
          requestId,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.error(`[WebSocket] Error sending event:`, error);
    }
  }

  private handlePatternMatchRequest(
    socket: WebSocket,
    request: any,
  ): void {
    try {
      // Validate pattern matching request
      if (
        !request.id || !request.boardData || request.sign === undefined ||
        !request.vertex
      ) {
        this.sendError(socket, "Invalid pattern matching request format");
        return;
      }

      console.log(
        `[PatternMatch] Received request ${request.id} for move at [${
          request.vertex[0]
        }, ${request.vertex[1]}]`,
      );

      // Convert request to PatternMatchRequest format
      const patternRequest: PatternMatchRequest = {
        id: request.id,
        boardData: request.boardData,
        sign: request.sign,
        vertex: request.vertex,
        boardSize: request.boardSize,
      };

      // Process pattern matching
      const response = this.patternMatcher.nameMove(patternRequest);

      // Send response with pattern-match event type
      const patternResponse = {
        type: "pattern-match",
        ...response,
      };

      this.sendPatternMatchResponse(socket, patternResponse);
    } catch (error) {
      console.error(`[PatternMatch] Error processing request:`, error);
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      this.sendError(socket, `Pattern matching failed: ${errorMessage}`);
    }
  }

  private sendPatternMatchResponse(socket: WebSocket, response: any): void {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error(`[WebSocket] Error sending pattern match response:`, error);
    }
  }

  public shutdown(): void {
    console.log(`[Server] Shutting down server...`);

    // Close all WebSocket connections
    this.websocketConnections.forEach((socket) => {
      try {
        socket.close();
      } catch (error) {
        console.error(`[WebSocket] Error closing connection:`, error);
      }
    });

    // Kill KataGo process
    if (this.katago) {
      this.katago.ProcessKill();
      this.katago = null;
    }

    console.log(`[Server] Server shutdown complete`);
  }

  public getServerStats(): any {
    return {
      uptime: Date.now() - this.serverStartTime,
      activeConnections: this.websocketConnections.size,
      queuedAnalyses: this.analysisQueue.length,
      processingAnalysis: this.processingAnalysis,
      config: this.config,
    };
  }
}

// Main server startup
async function main(): Promise<void> {
  console.log("Starting Baduk Live Analysis Server...");

  // Parse command line arguments
  const argumentParser = new ArgumentParser(Deno.args);
  const argConfig = argumentParser.parseArgs();

  // Load configuration
  const configManager = new ConfigManager();
  await configManager.loadConfig();

  // Apply command line overrides
  if (Object.keys(argConfig).length > 0) {
    configManager.updateConfig(argConfig);
    console.log(`[Config] Applied command line overrides`);
  }

  // Validate configuration
  const validation = configManager.validateConfig();
  if (!validation.valid) {
    console.error(`[Config] Configuration validation failed:`);
    validation.errors.forEach((error) => console.error(`  - ${error}`));
    Deno.exit(1);
  }

  console.log(`[Config] Configuration validated successfully`);

  // Create and start server
  const server = new AnalysisServer(configManager.getConfig(), configManager);

  // Handle shutdown signals
  const handleShutdown = () => {
    console.log(`[Server] Received shutdown signal`);
    server.shutdown();
    Deno.exit(0);
  };

  // Listen for shutdown signals
  Deno.addSignalListener("SIGINT", handleShutdown);

  // Only add SIGTERM on non-Windows platforms
  if (Deno.build.os !== "windows") {
    Deno.addSignalListener("SIGTERM", handleShutdown);
  }

  try {
    await server.start();

    // Keep server running
    console.log(`[Server] Server is running. Press Ctrl+C to stop.`);
  } catch (error) {
    console.error(`[Server] Fatal error:`, error);
    Deno.exit(1);
  }
}

// Run the server
if (import.meta.main) {
  main();
}
