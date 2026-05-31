// Version: 3.1 - Enhanced UI Integration with Event-Driven Architecture + AI Analysis WebSocket Manager
const logger = globalThis.logger ?? {
  enabled: false,
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
const OGS_WS_VERSION = 3.1;
logger.log(`[OGS-WS] Version ${OGS_WS_VERSION} loaded`);

// Board State Controller Class
class BoardStateController {
  constructor(size = 19) {
    this.size = size;
    this.board = this.createEmptyBoard();
    this.moveHistory = [];
    this.captures = { black: 0, white: 0 };
    this.koPoint = null; // For ko rule
  }

  // Create empty board
  createEmptyBoard() {
    const board = [];
    for (let i = 0; i < this.size; i++) {
      board[i] = [];
      for (let j = 0; j < this.size; j++) {
        board[i][j] = 0; // 0 = empty, 1 = black, 2 = white
      }
    }
    return board;
  }

  // Reset board to empty state
  resetBoard() {
    // Removed excessive logging - only keep errors if needed
    this.board = this.createEmptyBoard();
    this.moveHistory = [];
    this.captures = { black: 0, white: 0 };
    this.koPoint = null;
  }

  // Initialize board from move list
  initializeFromMoves(moves) {
    // Note: Do not reset board here - handicap stones may have been placed

    if (!moves || moves.length === 0) {
      return;
    }

    let captureEvents = 0;
    moves.forEach((move, index) => {
      if (move.move !== "pass" && move.coordinates) {
        const capturesBefore = this.captures.black + this.captures.white;
        const success = this.playMove(
          move.coordinates[0],
          move.coordinates[1],
          move.color,
        );
        const capturesAfter = this.captures.black + this.captures.white;

        if (capturesAfter > capturesBefore) {
          captureEvents++;
        }

        if (!success) {
          logger.warn(
            `[BoardController] Failed to play move: ${move.move} (${move.color})`,
          );
        }
      }
    });
    // Only log final summary, not every step
    // logger.log(`[BoardController] Replayed ${moves.length} moves with ${captureEvents} capture events`);
    // logger.log(`[BoardController] Final captures: Black=${this.captures.black}, White=${this.captures.white}`);
  }

  // Place handicap stones from OGS initial_state format
  placeHandicapStones(initialState) {
    const letters = "abcdefghjklmnopqrst";
    logger.log(
      `[BoardController] placeHandicapStones called with:`,
      initialState,
    );

    // Place black handicap stones
    if (initialState.black) {
      logger.log(
        `[BoardController] Parsing black stones from: "${initialState.black}"`,
      );
      const blackStones = this.parseInitialStateString(initialState.black);
      logger.log(`[BoardController] Parsed black stones:`, blackStones);
      blackStones.forEach((coords) => {
        logger.log(
          `[BoardController] Placing black stone at [${coords.x}, ${coords.y}]`,
        );
        this.board[coords.x][coords.y] = 1; // 1 = black stone
      });
      logger.log(
        `[BoardController] Placed ${blackStones.length} black handicap stones`,
      );
    }

    // Place white handicap stones (rare, but possible)
    if (initialState.white) {
      logger.log(
        `[BoardController] Parsing white stones from: "${initialState.white}"`,
      );
      const whiteStones = this.parseInitialStateString(initialState.white);
      logger.log(`[BoardController] Parsed white stones:`, whiteStones);
      whiteStones.forEach((coords) => {
        logger.log(
          `[BoardController] Placing white stone at [${coords.x}, ${coords.y}]`,
        );
        this.board[coords.x][coords.y] = 2; // 2 = white stone
      });
      logger.log(
        `[BoardController] Placed ${whiteStones.length} white handicap stones`,
      );
    }
  }

  // Parse OGS initial_state string format to coordinate arrays
  parseInitialStateString(stateString) {
    const coordinates = [];
    const letters = "abcdefghijklmnopqrs";

    logger.log(
      `[BoardController] parseInitialStateString input: "${stateString}"`,
    );
    for (let i = 0; i < stateString.length; i += 2) {
      if (i + 1 < stateString.length) {
        const char1 = stateString[i];
        const char2 = stateString[i + 1];
        const x_index = letters.indexOf(char1);
        const y_index = letters.indexOf(char2);
        if (x_index !== -1 && y_index !== -1) {
          coordinates.push({ x: x_index, y: y_index });
          const x_letter = letters[x_index];
          const y_number = 19 - y_index;
          logger.log(
            `[BoardController] Handicap stone at [${x_index}, ${y_index}] = ${x_letter}${y_number} from "${char1}${char2}"`,
          );
        }
      }
    }
    logger.log(
      `[BoardController] Parsed ${coordinates.length} handicap stone positions`,
    );
    return coordinates;
  }

  // Play a move on the board
  playMove(x, y, color) {
    if (!this.isValidMove(x, y, color)) {
      return false;
    }

    const colorValue = color === "black" ? 1 : 2;
    const opponentColorValue = color === "black" ? 2 : 1;

    // Place stone
    this.board[x][y] = colorValue;

    // Check for opponent captures first
    const capturedStones = this.checkOpponentCaptures(x, y, opponentColorValue);
    let totalCaptured = 0;

    // Remove captured opponent stones
    capturedStones.forEach((pos) => {
      this.board[pos.x][pos.y] = 0;
      totalCaptured++;
    });

    // Update capture count
    if (totalCaptured > 0) {
      this.captures[color] += totalCaptured;
    }

    // Now check if the placed stone/group has liberties (suicide rule)
    const placedGroup = this.getGroup(x, y);
    if (this.hasNoLiberties(placedGroup)) {
      // If no captures were made and the placed group has no liberties, it's illegal (suicide)
      if (totalCaptured === 0) {
        // Illegal move - remove the stone and return false
        this.board[x][y] = 0;
        return false;
      }
      // If captures were made, the move is legal even if it results in self-capture
    }

    // Record move with capture information
    this.moveHistory.push({
      x,
      y,
      color,
      colorValue,
      captured: totalCaptured,
      capturedStones: capturedStones,
      boardState: this.getBoardState(),
    });

    return true;
  }

  // Check if move is valid (basic checks only)
  isValidMove(x, y, _color) {
    // Check bounds
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
      return false;
    }

    // Check if position is empty
    if (this.board[x][y] !== 0) {
      return false;
    }

    // Additional validation (suicide rule) will be checked in playMove
    return true;
  }

  // Check for opponent captures around a position
  checkOpponentCaptures(x, y, opponentColorValue) {
    const captured = [];
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const checkedGroups = new Set();

    directions.forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;

      if (
        this.isInBounds(nx, ny) && this.board[nx][ny] === opponentColorValue
      ) {
        const groupKey = `${nx},${ny}`;
        if (!checkedGroups.has(groupKey)) {
          const group = this.getGroup(nx, ny);

          // Mark all stones in this group as checked
          group.forEach((pos) => checkedGroups.add(`${pos.x},${pos.y}`));

          // Check if this group has no liberties
          if (this.hasNoLiberties(group)) {
            captured.push(...group);
          }
        }
      }
    });

    return captured;
  }

  // Get connected group of stones
  getGroup(x, y) {
    const color = this.board[x][y];
    const group = [];
    const visited = new Set();
    const stack = [{ x, y }];

    while (stack.length > 0) {
      const pos = stack.pop();
      const key = `${pos.x},${pos.y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (this.board[pos.x][pos.y] === color) {
        group.push(pos);

        // Check adjacent positions
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        directions.forEach(([dx, dy]) => {
          const nx = pos.x + dx;
          const ny = pos.y + dy;
          if (this.isInBounds(nx, ny)) {
            stack.push({ x: nx, y: ny });
          }
        });
      }
    }

    return group;
  }

  // Check if group has no liberties
  hasNoLiberties(group) {
    const liberties = new Set();

    for (const pos of group) {
      const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      for (const [dx, dy] of directions) {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        if (this.isInBounds(nx, ny) && this.board[nx][ny] === 0) {
          liberties.add(`${nx},${ny}`);
        }
      }
    }

    return liberties.size === 0; // No liberties found
  }

  // Check if coordinates are within board bounds
  isInBounds(x, y) {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  // Get stone at position
  getStone(x, y) {
    if (!this.isInBounds(x, y)) return null;
    const value = this.board[x][y];
    if (value === 0) return null;
    return value === 1 ? "black" : "white";
  }

  // Get current board state
  getBoardState() {
    return this.board.map((row) => [...row]);
  }

  // Get board as string representation
  getBoardString() {
    const symbols = [".", "B", "W"];
    return this.board.map((row) => row.map((cell) => symbols[cell]).join(" "))
      .join("\n");
  }

  // Get territory and scoring information
  getTerritory() {
    // Simplified territory calculation
    const territory = { black: 0, white: 0, neutral: 0 };
    const visited = new Set();

    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const key = `${x},${y}`;
        if (!visited.has(key) && this.board[x][y] === 0) {
          const emptyGroup = this.getEmptyGroup(x, y);
          const surroundingColors = this.getSurroundingColors(emptyGroup);

          emptyGroup.forEach((pos) => visited.add(`${pos.x},${pos.y}`));

          if (surroundingColors.size === 1) {
            const color = Array.from(surroundingColors)[0];
            territory[color] += emptyGroup.length;
          } else {
            territory.neutral += emptyGroup.length;
          }
        }
      }
    }

    return territory;
  }

  // Get connected empty group
  getEmptyGroup(x, y) {
    const group = [];
    const visited = new Set();
    const stack = [{ x, y }];

    while (stack.length > 0) {
      const pos = stack.pop();
      const key = `${pos.x},${pos.y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (this.board[pos.x][pos.y] === 0) {
        group.push(pos);

        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        directions.forEach(([dx, dy]) => {
          const nx = pos.x + dx;
          const ny = pos.y + dy;
          if (this.isInBounds(nx, ny)) {
            stack.push({ x: nx, y: ny });
          }
        });
      }
    }

    return group;
  }

  // Get colors surrounding an empty group
  getSurroundingColors(emptyGroup) {
    const colors = new Set();

    emptyGroup.forEach((pos) => {
      const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      directions.forEach(([dx, dy]) => {
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        if (this.isInBounds(nx, ny) && this.board[nx][ny] !== 0) {
          colors.add(this.board[nx][ny] === 1 ? "black" : "white");
        }
      });
    });

    return colors;
  }
}

// AI Analysis Manager Class
class AIAnalysisManager {
  constructor(hostname = location.hostname, port = 8081, context = null) {
    this.hostname = hostname;
    this.port = port;
    this.context = context;
    this.websocket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000; // 3 seconds
    this.analysisQueue = new Map(); // Track pending analyses
    this.maxVisits = 10;

    // Event handlers
    this.onAnalysisResult = null;
    this.onConnectionStatus = null;
    this.onError = null;
    this.onPatternMatch = null; // New handler for pattern match
  }

  // Connect to AI analysis server
  connect() {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      logger.log(`[AIAnalysis] Already connected`);
      return;
    }

    const queryParams = new URLSearchParams();
    if (this.context) {
      queryParams.set("type", this.context.type);
      queryParams.set("id", this.context.id);
    }
    if (globalThis.logger?.enabled) queryParams.set("debug", "1");
    const contextQuery = queryParams.toString() ? `?${queryParams}` : "";
    const pageProtocol = globalThis.location?.protocol;
    const isHttpsPage = pageProtocol === "https:";
    const isDefaultAiEndpoint =
      this.hostname === globalThis.location?.hostname &&
      Number(this.port) === 8081;
    const wsUrl = isHttpsPage && isDefaultAiEndpoint
      ? `wss://${globalThis.location.host}/ai/${contextQuery}`
      : `${
        isHttpsPage ? "wss" : "ws"
      }://${this.hostname}:${this.port}${contextQuery}`;
    logger.log(`[AIAnalysis] Connecting to ${wsUrl}`);

    try {
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        logger.log(`[AIAnalysis] Connected to AI server`);
        this.connected = true;
        this.reconnectAttempts = 0;
        if (this.context) {
          this.sendCommand(
            "connect-context",
            {},
            `connect/${this.context.type}/${this.context.id}`,
          );
        }
        this.callEventHandler("onConnectionStatus", { connected: true });
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logger.log(`[AIAnalysis] Received analysis result:`, data);
          this.handleAnalysisResult(data);
        } catch (error) {
          logger.error(`[AIAnalysis] Error parsing response:`, error);
          this.callEventHandler("onError", { type: "parse_error", error });
        }
      };

      this.websocket.onclose = (event) => {
        logger.log(
          `[AIAnalysis] Connection closed:`,
          event.code,
          event.reason,
        );
        this.connected = false;
        this.callEventHandler("onConnectionStatus", { connected: false });

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          logger.log(`[AIAnalysis] Max reconnect attempts reached`);
          this.callEventHandler("onError", { type: "connection_failed" });
        }
      };

      this.websocket.onerror = (error) => {
        logger.error(`[AIAnalysis] WebSocket error:`, error);
        this.callEventHandler("onError", { type: "websocket_error", error });
      };
    } catch (error) {
      logger.error(`[AIAnalysis] Failed to create WebSocket:`, error);
      this.callEventHandler("onError", { type: "connection_error", error });
    }
  }

  // Schedule reconnection attempt
  scheduleReconnect() {
    this.reconnectAttempts++;
    logger.log(
      `[AIAnalysis] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
    );

    setTimeout(() => {
      if (!this.connected) {
        this.connect();
      }
    }, this.reconnectInterval);
  }

  // Disconnect from AI server
  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.connected = false;
    this.analysisQueue.clear();
    logger.log(`[AIAnalysis] Disconnected from AI server`);
  }

  sendCommand(command, payload = {}, requestId = null) {
    if (!this.connected || !this.websocket) {
      return false;
    }
    const message = {
      type: "command",
      command,
      context: this.context,
      payload,
      requestId: requestId || `${command}/${Date.now()}`,
    };
    this.websocket.send(JSON.stringify(message));
    return true;
  }

  formatStateSnapshot(gameState, gameType) {
    if (!gameState) return null;
    const gameId = gameState.id || "unknown";
    return {
      id: String(gameId),
      context: { type: gameType, id: String(gameId) },
      moves: (gameState.moves || []).map((move) => ({
        moveNumber: move.moveNumber || 0,
        color: move.color,
        move: move.move,
        coordinates: move.coordinates || null,
      })),
      currentPlayer: gameState.currentPlayer,
      boardSize: gameState.boardSize || 19,
      rules: this.getGameRules(gameState),
      komi: this.getKomi(gameState),
      initialStones: this.getInitialStones(gameState),
      captures: gameState.captures || { black: 0, white: 0 },
    };
  }

  syncState(gameState, gameType = "game") {
    const snapshot = this.formatStateSnapshot(gameState, gameType);
    if (!snapshot || !this.context) return false;
    return this.sendCommand(
      "sync-state",
      snapshot,
      `sync/${snapshot.context.type}/${snapshot.context.id}/${snapshot.moves.length}`,
    );
  }

  // Send analysis request
  requestAnalysis(gameState, gameType = "game", moveNumber = null) {
    if (!this.connected || !this.websocket) {
      logger.log(`[AIAnalysis] Not connected - cannot send analysis request`);
      return false;
    }

    // Use current move number if not provided
    if (moveNumber === null) {
      moveNumber = gameState.moves ? gameState.moves.length : 0;
    }

    const analysisRequest = this.formatAnalysisRequest(
      gameState,
      gameType,
      moveNumber,
    );

    if (!analysisRequest) {
      logger.error(`[AIAnalysis] Failed to format analysis request`);
      return false;
    }

    try {
      logger.log(
        `[AIAnalysis] Sending analysis request command:`,
        analysisRequest,
      );

      if (this.context) {
        this.syncState(gameState, gameType);
        this.sendCommand(
          "request-analysis",
          {
            id: analysisRequest.id,
            moveNumber,
            includePolicy: analysisRequest.includePolicy,
            includeOwnership: analysisRequest.includeOwnership,
            maxVisits: analysisRequest.maxVisits,
          },
          analysisRequest.id,
        );
      } else {
        // Legacy fallback for standalone/manual connections without a context.
        this.websocket.send(JSON.stringify(analysisRequest));
      }

      // Track pending analysis
      this.analysisQueue.set(analysisRequest.id, {
        timestamp: Date.now(),
        request: analysisRequest,
      });

      return true;
    } catch (error) {
      logger.error(`[AIAnalysis] Error sending analysis request:`, error);
      this.callEventHandler("onError", { type: "send_error", error });
      return false;
    }
  }

  // Format analysis request from game state
  formatAnalysisRequest(gameState, gameType, moveNumber) {
    if (!gameState) {
      logger.error(`[AIAnalysis] Invalid game state provided`);
      return null;
    }

    // Create unique ID scoped by game type, game id, and move number.
    // Example: review_123456_move_1
    const gameId = gameState.id || "unknown";
    const safeGameType = String(gameType).replace(/[^A-Za-z0-9-]/g, "_");
    const safeGameId = String(gameId).replace(/[^A-Za-z0-9-]/g, "_");
    const id = `${safeGameType}_${safeGameId}_move_${moveNumber}`;

    // Convert moves to required format [[color, "letter + number"]]
    const moves = gameState.moves
      ? gameState.moves.map((move) => {
        if (move.move === "pass") {
          return [move.color, "pass"];
        } else {
          return [move.color, move.move];
        }
      })
      : [];

    // Get initial stones (for handicap games)
    const initialStones = this.getInitialStones(gameState);

    // Get game rules and settings
    const rules = this.getGameRules(gameState);
    const komi = this.getKomi(gameState);
    const boardSize = this.getBoardSize(gameState);

    const analysisRequest = {
      id: id,
      context: { type: gameType, id: String(gameId) },
      moves: moves,
      initialStones: initialStones,
      rules: rules,
      komi: komi,
      boardXSize: boardSize.width,
      boardYSize: boardSize.height,
      includePolicy: false,
      includeOwnership: true,
      maxVisits: this.maxVisits,
    };

    return analysisRequest;
  }

  // Get initial stones (handicap stones)
  getInitialStones(gameState) {
    const initialStones = [];

    logger.log(
      `[AIAnalysis] getInitialStones called with gameState:`,
      gameState,
    );
    logger.log(`[AIAnalysis] gameState.initialState:`, gameState.initialState);

    if (gameState.initialState) {
      // Parse black handicap stones
      if (gameState.initialState.black) {
        logger.log(
          `[AIAnalysis] Parsing black handicap stones from: "${gameState.initialState.black}"`,
        );
        const blackStones = this.parseInitialState(
          gameState.initialState.black,
        );
        logger.log(`[AIAnalysis] Parsed black stones:`, blackStones);
        blackStones.forEach((stone) => {
          initialStones.push(["black", stone]);
        });
      }

      // Parse white handicap stones (rare, but possible)
      if (gameState.initialState.white) {
        logger.log(
          `[AIAnalysis] Parsing white handicap stones from: "${gameState.initialState.white}"`,
        );
        const whiteStones = this.parseInitialState(
          gameState.initialState.white,
        );
        logger.log(`[AIAnalysis] Parsed white stones:`, whiteStones);
        whiteStones.forEach((stone) => {
          initialStones.push(["white", stone]);
        });
      }
    } else {
      logger.log(`[AIAnalysis] No initialState found in gameState`);
    }

    logger.log(
      `[AIAnalysis] Returning ${initialStones.length} initial stones:`,
      initialStones,
    );
    return initialStones;
  }

  // Parse initial state string format to coordinates
  parseInitialState(stateString) {
    const coordinates = [];
    const letters = "abcdefghijklmnopqrs";
    logger.log(`[AIAnalysis] parseInitialState input: "${stateString}"`);
    for (let i = 0; i < stateString.length; i += 2) {
      if (i + 1 < stateString.length) {
        const char1 = stateString[i];
        const char2 = stateString[i + 1];
        const x_index = letters.indexOf(char1);
        const y_index = letters.indexOf(char2);
        if (x_index !== -1 && y_index !== -1) {
          const x_letter = letters[x_index];
          const y_number = 19 - y_index;
          const coord = `${x_letter}${y_number}`;
          coordinates.push(coord);
          logger.log(
            `[AIAnalysis] Parsed "${char1}${char2}" -> [${x_index},${y_index}] -> ${coord}`,
          );
        }
      }
    }
    logger.log(`[AIAnalysis] Final coordinates:`, coordinates);
    return coordinates;
  }

  // Get game rules
  getGameRules(_gameState) {
    // Default to Japanese rules
    // TODO: Extract from game state if available
    return "japanese";
  }

  // Get komi value
  getKomi(gameState) {
    // Default komi for even games
    // TODO: Extract from game state if available
    const komi = Number(gameState.komi);
    return Number.isFinite(komi) ? komi : 7.5;
  }

  // Get board size
  getBoardSize(gameState) {
    // Default to 19x19
    // TODO: Extract from game state if available
    return {
      width: gameState.boardSize || 19,
      height: gameState.boardSize || 19,
    };
  }

  // Handle analysis result
  handleAnalysisResult(data) {
    if (data.type === "event") {
      if (data.event === "analysis-completed" && data.payload) {
        this.handleAnalysisResult(data.payload);
      } else if (data.event === "move-quality-updated") {
        this.callEventHandler("onAnalysisResult", {
          id: data.requestId || data.event,
          context: data.context,
          moveQuality: data.payload,
          timestamp: data.timestamp,
        });
      } else if (data.event === "state-synced") {
        return;
      } else if (data.event === "state" || data.event === "context-connected") {
        const payload = data.payload || {};
        const latestAnalysis = payload.latestAnalysis || {};
        this.callEventHandler("onAnalysisResult", {
          ...latestAnalysis,
          id: latestAnalysis.id || data.requestId || data.event,
          context: data.context,
          gameState: payload.gameState || null,
          moveQuality: payload.moveQuality || latestAnalysis.moveQuality ||
            null,
          timestamp: data.timestamp,
          restoredFromServer: true,
        });
      }
      return;
    }

    if (!data.id) {
      logger.error(`[AIAnalysis] Received result without ID`);
      return;
    }

    // Check if this is a pattern-match event
    if (data.type === "pattern-match") {
      this.handlePatternMatchResult(data);
      return;
    }

    // Remove from pending queue
    if (this.analysisQueue.has(data.id)) {
      this.analysisQueue.delete(data.id);
    }

    // Call result handler
    this.callEventHandler("onAnalysisResult", data);
  }

  // Handle pattern match result
  handlePatternMatchResult(data) {
    logger.log(`[AIAnalysis] Received pattern match:`, data);

    // Call pattern match handler if registered
    this.callEventHandler("onPatternMatch", data);
  }

  // Set maximum visits for analysis
  setMaxVisits(visits) {
    this.maxVisits = visits;
    if (this.connected && this.context) {
      this.sendCommand(
        "set-analysis-settings",
        { maxVisits: visits },
        `settings/${Date.now()}`,
      );
    }
    // logger.log(`[AIAnalysis] Max visits set to ${visits}`);
  }

  // Get connection status
  isConnected() {
    return this.connected;
  }

  // Get pending analysis count
  getPendingAnalysisCount() {
    return this.analysisQueue.size;
  }

  // Clear pending analyses
  clearPendingAnalyses() {
    this.analysisQueue.clear();
    logger.log(`[AIAnalysis] Cleared pending analyses`);
  }

  // Event handler management
  setAnalysisResultHandler(handler) {
    this.onAnalysisResult = handler;
  }

  setConnectionStatusHandler(handler) {
    this.onConnectionStatus = handler;
  }

  setErrorHandler(handler) {
    this.onError = handler;
  }

  setPatternMatchHandler(handler) {
    this.onPatternMatch = handler;
  }

  // Call event handler safely
  callEventHandler(handlerName, data) {
    try {
      const handler = this[handlerName];
      if (typeof handler === "function") {
        handler(data);
      }
    } catch (error) {
      logger.error(`[AIAnalysis] Error in ${handlerName}:`, error);
    }
  }
}

// Game Engine Wrapper Class - Enhanced with Event System
class GameEngineWrapper {
  constructor(type, id, ogsSocket) {
    this.type = type; // 'game' or 'review'
    this.id = id;
    this.ogsSocket = ogsSocket;
    this.currentGame = null;
    this.currentReview = null;
    this.clockInterval = null;
    this.boardController = new BoardStateController();
    this.lastAutoAnalysisKey = null;

    // Event handler system
    this.eventFunctionHandlers = {};

    // AI Analysis Manager - defaults to hostname:8081 and binds this socket to one game/review
    this.aiAnalysis = new AIAnalysisManager(location.hostname, 8081, {
      type: this.type,
      id: String(this.id),
    });
    this.setupAIAnalysisHandlers();

    // Auto-connect to AI server
    this.autoConnectToAI();

    // Set up OGS event listeners automatically
    this.setupOGSListeners();
  }

  // Event handler management
  addEventHandler(eventName, handler) {
    if (!this.eventFunctionHandlers[eventName]) {
      this.eventFunctionHandlers[eventName] = [];
    }
    this.eventFunctionHandlers[eventName].push(handler);
  }

  removeEventHandler(eventName, handler) {
    if (this.eventFunctionHandlers[eventName]) {
      const index = this.eventFunctionHandlers[eventName].indexOf(handler);
      if (index > -1) {
        this.eventFunctionHandlers[eventName].splice(index, 1);
      }
    }
  }

  callEventHandler(eventName, ...args) {
    if (this.eventFunctionHandlers[eventName]) {
      this.eventFunctionHandlers[eventName].forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          logger.error(`Error in event handler for ${eventName}:`, error);
        }
      });
    }
  }

  // Merge AI-server snapshots without dropping OGS-only live metadata.
  mergeAnalysisState(currentState, analysisState) {
    if (!currentState) return analysisState;
    if (!analysisState || typeof analysisState !== "object") return currentState;

    return {
      ...currentState,
      ...analysisState,
      players: analysisState.players || currentState.players,
      clock: analysisState.clock || currentState.clock,
      phase: analysisState.phase || currentState.phase,
      finished: analysisState.finished ?? currentState.finished,
      currentPlayer: analysisState.currentPlayer || currentState.currentPlayer,
    };
  }

  // Set up AI analysis event handlers
  setupAIAnalysisHandlers() {
    // Set up analysis result handler
    this.aiAnalysis.setAnalysisResultHandler((result) => {
      logger.log(`[GameEngine] Received analysis result:`, result);

      // Restore latest server-tracked game/review state first, then analysis.
      // The AI server snapshot is intentionally small and may not include OGS-only
      // fields such as players/clock. Merge it into the existing state instead of
      // replacing the live game object, otherwise clock code can lose players.*.
      if (result.gameState) {
        const displayState = this.mergeAnalysisState(
          this.type === "review" ? this.currentReview : this.currentGame,
          result.gameState,
        );
        if (this.type === "review") {
          this.currentReview = displayState;
        } else {
          this.currentGame = displayState;
        }
        if (globalThis.uiManager) {
          globalThis.uiManager.updateUI(displayState);
          // Do not render the AI-server board snapshot here. It is row-major
          // ([y][x]) while the client BoardStateController is column-major
          // ([x][y]), which can transpose stones during load/restore.
          globalThis.uiManager.updateBoard(
            displayState.moves || [],
            this.boardController.getBoardState(),
          );
        }
      }

      // Update UI with analysis results
      if (globalThis.uiManager) {
        globalThis.uiManager.updateAnalysis(result);
      }

      this.callEventHandler("analysis", result);
    });

    // Set up pattern match handler
    this.aiAnalysis.setPatternMatchHandler((patternData) => {
      logger.log(`[GameEngine] Received pattern match:`, patternData);

      // Update UI with pattern information
      if (globalThis.uiManager) {
        globalThis.uiManager.updatePatternMatch(patternData);
      }

      this.callEventHandler("patternMatch", patternData);
    });

    // Set up connection status handler
    this.aiAnalysis.setConnectionStatusHandler((status) => {
      logger.log(`[GameEngine] AI connection status:`, status);
      if (status.connected) {
        this.requestCurrentPositionAnalysis("ai-connected");
      }
      this.callEventHandler("aiConnectionStatus", status);
    });

    // Set up error handler
    this.aiAnalysis.setErrorHandler((error) => {
      logger.error(`[GameEngine] AI analysis error:`, error);
      this.callEventHandler("aiError", error);
    });
  }

  // Auto-connect to AI analysis server
  autoConnectToAI() {
    // Check if auto-connect is enabled (can be controlled globally)
    const autoConnect = globalThis.AIAutoConnect !== false; // Default to true

    if (autoConnect) {
      const hostname = globalThis.AIHostname || location.hostname;
      const port = globalThis.AIPort || 8081;
      logger.log(
        `[GameEngine] Auto-connecting to AI analysis server at ${hostname}:${port}`,
      );
      this.connectToAI(hostname, port);

      // Set max visits from global setting
      if (globalThis.AIMaxVisits) {
        this.setAIMaxVisits(globalThis.AIMaxVisits);
      }
    } else {
      logger.log(
        `[GameEngine] AI auto-connect disabled. Use connectToAI() to connect manually.`,
      );
    }
  }

  // Connect to AI analysis server
  connectToAI(hostname = location.hostname, port = 8081) {
    logger.log(`[GameEngine] Connecting to AI server at ${hostname}:${port}`);
    this.aiAnalysis.hostname = hostname;
    this.aiAnalysis.port = port;
    this.aiAnalysis.connect();
  }

  // Disconnect from AI analysis server
  disconnectFromAI() {
    this.aiAnalysis.disconnect();
  }

  requestCurrentPositionAnalysis(reason = "current-position") {
    const gameState = this.getCurrentState();
    const moveNumber = gameState?.moves ? gameState.moves.length : 0;
    if (moveNumber === 0) {
      logger.log(`[GameEngine] Skipping initial analysis for empty board`);
      return false;
    }
    if (!this.aiAnalysis.isConnected()) {
      logger.log(
        `[GameEngine] AI not connected yet; will analyze current position after connect`,
      );
      return false;
    }

    const key = `${this.type}/${this.id}/${moveNumber}`;
    if (this.lastAutoAnalysisKey === key) {
      logger.log(`[GameEngine] Current position already requested: ${key}`);
      return false;
    }

    this.lastAutoAnalysisKey = key;
    logger.log(
      `[GameEngine] Requesting ${reason} analysis for move ${moveNumber}`,
    );
    return this.requestAnalysis(moveNumber);
  }

  // Request analysis for current game state
  requestAnalysis(moveNumber = null) {
    const gameState = this.getCurrentState();
    if (!gameState) {
      logger.log(`[GameEngine] No game state available for analysis`);
      return false;
    }

    return this.aiAnalysis.requestAnalysis(gameState, this.type, moveNumber);
  }

  // Set AI analysis settings
  setAIMaxVisits(visits) {
    this.aiAnalysis.setMaxVisits(visits);
  }

  // Get AI analysis status
  getAIStatus() {
    return {
      connected: this.aiAnalysis.isConnected(),
      pendingAnalyses: this.aiAnalysis.getPendingAnalysisCount(),
      maxVisits: this.aiAnalysis.maxVisits,
    };
  }

  // Set up OGS event listeners based on type
  setupOGSListeners() {
    if (this.type === "game") {
      this.setupGameListeners();
    } else if (this.type === "review") {
      this.setupReviewListeners();
    }
  }

  // Set up game-specific OGS listeners
  setupGameListeners() {
    // Game data event
    this.ogsSocket.on(`game/${this.id}/gamedata`, (data) => {
      logger.log(`[GameEngine] Game data received:`, data);

      // Store raw game data for inspection
      globalThis.lastGameData = data;

      this.initializeGame(data);
      this.callEventHandler("gamedata", this.currentGame);

      // Call UIManager directly if available
      if (globalThis.uiManager) {
        globalThis.uiManager.updateUI(this.currentGame);
      }

      if (data.phase === "finished") {
        logger.log(`[GameEngine] Game finished`);
        this.updateGamePhase("finished");
        this.callEventHandler("phase", "finished");
        this.ogsSocket.send(["game/disconnect", { game_id: this.id }]);
      }
    });

    // Move event
    this.ogsSocket.on(`game/${this.id}/move`, (data) => {
      logger.log(`[GameEngine] Move received:`, data);
      const parsedMove = this.addGameMove(data);
      if (parsedMove) {
        logger.log(`[GameEngine] Parsed move:`, parsedMove);
        this.callEventHandler("move", parsedMove);

        // Note: UI update is handled in addGameMove() with correct board state
        // No additional UI calls needed here to avoid overriding captures

        // Clock will be updated by separate clock event from server
        // Don't manually set current_player - it should only come from server clock data
      }
    });

    // Clock event
    this.ogsSocket.on(`game/${this.id}/clock`, (data) => {
      logger.log(`[GameEngine] Clock update:`, data);
      this.updateGameClock(data);
      this.callEventHandler("clock", this.currentGame.clock);

      // Call UIManager directly if available
      if (globalThis.uiManager) {
        globalThis.uiManager.updateClock(this.currentGame.clock);
      }
    });

    // Phase event
    this.ogsSocket.on(`game/${this.id}/phase`, (data) => {
      logger.log(`[GameEngine] Phase update:`, data);
      this.updateGamePhase(data);
      this.callEventHandler("phase", data);

      // Call UIManager directly if available
      if (globalThis.uiManager) {
        globalThis.uiManager.updateGameStatus({ phase: data });
      }

      if (data === "finished") {
        this.ogsSocket.send(["game/disconnect", { game_id: this.id }]);
      }
    });
  }

  // Set up review-specific OGS listeners
  setupReviewListeners() {
    // Review full state event
    this.ogsSocket.on(`review/${this.id}/full_state`, (data) => {
      logger.log(`[GameEngine] Review full state received:`, data);

      // Live-game reviews include gamedata.game_id. They are allowed here and
      // handled the same as demo-board reviews.
      this.initializeReview(data);
      this.callEventHandler("reviewdata", this.currentReview);

      // Call UIManager directly if available
      if (globalThis.uiManager) {
        globalThis.uiManager.updateUI(this.currentReview);
      }

      logger.log(`[GameEngine] Review data processed successfully`);
    });

    // Review move event
    this.ogsSocket.on(`review/${this.id}/r`, (data) => {
      logger.log(`[GameEngine] Review move:`, data);

      if (data.m === undefined || data.m === null) {
        return;
      }

      // updateReviewMoves handles everything including UI updates with correct board state
      // This includes empty strings (which represent empty board state)
      // Pass the full data object to preserve timestamp information
      this.updateReviewMoves(data.m, data.ts);

      // No additional UI calls needed - updateReviewMoves does it all correctly
    });
  }

  // Connect to the game/review
  connect() {
    if (this.type === "game") {
      logger.log(`[GameEngine] Connecting to game ${this.id}`);
      this.ogsSocket.emit("game/connect", {
        game_id: this.id,
        chat: false,
      });
    } else if (this.type === "review") {
      logger.log(`[GameEngine] Connecting to review ${this.id}`);
      this.ogsSocket.emit("review/connect", {
        review_id: this.id,
        chat: false,
      });
    }
  }

  // Parse game moves from OGS format to readable format
  parseGameMoves(moves, initialPlayer = "black") {
    const letters = "abcdefghjklmnopqrst";
    const parsedMoves = [];

    // Determine starting color based on initial player
    const startingColor = initialPlayer === "white" ? "white" : "black";
    logger.log(
      `[GameEngine] parseGameMoves: initialPlayer=${initialPlayer}, startingColor=${startingColor}, moves.length=${moves.length}`,
    );

    moves.forEach((move, index) => {
      // For handicap games where white plays first, colors are swapped
      let color;
      if (startingColor === "white") {
        color = index % 2 === 0 ? "white" : "black";
      } else {
        color = index % 2 === 0 ? "black" : "white";
      }

      if (move[0] === -1 && move[1] === -1) {
        parsedMoves.push({
          color: color,
          move: "pass",
          coordinates: null,
          moveNumber: index + 1,
        });
      } else {
        const x = letters[move[0]];
        const y = 19 - move[1];
        parsedMoves.push({
          color: color,
          move: `${x}${y}`,
          coordinates: [move[0], move[1]],
          moveNumber: index + 1,
        });
      }

      // Debug first few moves only
      if (index < 5) {
        logger.log(
          `[GameEngine] Move ${index + 1}: ${color} plays ${
            parsedMoves[index].move
          }`,
        );
      }
    });

    return parsedMoves;
  }

  // Parse single move from OGS format
  parseSingleMove(move, currentColor, moveNumber) {
    const letters = "abcdefghjklmnopqrst";

    if (move[0] === -1 && move[1] === -1) {
      return {
        color: currentColor,
        move: "pass",
        coordinates: null,
        moveNumber: moveNumber,
      };
    } else {
      const x = letters[move[0]];
      const y = 19 - move[1];
      return {
        color: currentColor,
        move: `${x}${y}`,
        coordinates: [move[0], move[1]],
        moveNumber: moveNumber,
      };
    }
  }

  // Parse review moves from string format
  parseReviewMoves(moveString) {
    // Empty string = empty board (no moves)
    if (!moveString || moveString.trim() === "") {
      logger.log(`[GameEngine] Empty move string - returning empty board`);
      return [];
    }

    const coordinates = "abcdefghijklmnopqrs";
    const moves = [];
    let i = 0;
    let moveNumber = 1;

    while (i < moveString.length) {
      let move = null;

      // Check for special sequences
      if (i + 1 < moveString.length) {
        const twoChar = moveString.substring(i, i + 2);

        if (twoChar === "..") {
          // Pass move
          move = {
            color: moveNumber % 2 === 1 ? "black" : "white",
            move: "pass",
            coordinates: null,
            moveNumber: moveNumber,
          };
          i += 2;
        } else if (twoChar === "!1") {
          // Add black stone - get coordinates from next 2 characters
          if (i + 3 < moveString.length) {
            const coordStr = moveString.substring(i + 2, i + 4);
            const x_num = coordinates.indexOf(coordStr[0]);
            const y_num = coordinates.indexOf(coordStr[1]);

            if (x_num !== -1 && y_num !== -1) {
              const x = "abcdefghjklmnopqrst"[x_num];
              const y = 19 - y_num;
              move = {
                color: "black",
                move: `${x}${y}`,
                coordinates: [x_num, y_num],
                moveNumber: moveNumber,
              };
            }
            i += 4;
          } else {
            i += 2;
          }
        } else if (twoChar === "!2") {
          // Add white stone - get coordinates from next 2 characters
          if (i + 3 < moveString.length) {
            const coordStr = moveString.substring(i + 2, i + 4);
            const x_num = coordinates.indexOf(coordStr[0]);
            const y_num = coordinates.indexOf(coordStr[1]);

            if (x_num !== -1 && y_num !== -1) {
              const x = "abcdefghjklmnopqrst"[x_num];
              const y = 19 - y_num;
              move = {
                color: "white",
                move: `${x}${y}`,
                coordinates: [x_num, y_num],
                moveNumber: moveNumber,
              };
            }
            i += 4;
          } else {
            i += 2;
          }
        } else {
          // Regular coordinate pair
          const x_num = coordinates.indexOf(twoChar[0]);
          const y_num = coordinates.indexOf(twoChar[1]);

          if (x_num !== -1 && y_num !== -1) {
            const x = "abcdefghjklmnopqrst"[x_num];
            const y = 19 - y_num;
            move = {
              color: moveNumber % 2 === 1 ? "black" : "white",
              move: `${x}${y}`,
              coordinates: [x_num, y_num],
              moveNumber: moveNumber,
            };
          }
          i += 2;
        }
      } else {
        // Single character remaining
        i++;
      }

      if (move) {
        moves.push(move);
        moveNumber++;
      }
    }

    return moves;
  }

  // Initialize game data
  initializeGame(gameData) {
    // Simple alert to confirm function is called
    logger.log(`[GameEngine] === INITIALIZE GAME CALLED ===`);
    logger.log(`[GameEngine] Game ID: ${gameData.game_id}`);
    logger.log(`[GameEngine] Game name: ${gameData.game_name}`);
    logger.log(`[GameEngine] Handicap: ${gameData.handicap}`);
    logger.log(`[GameEngine] Initial player: ${gameData.initial_player}`);
    logger.log(`[GameEngine] Initial state:`, gameData.initial_state);

    // Force a visible log to confirm execution
    if (gameData.handicap > 0) {
      logger.warn(
        `[GameEngine] HANDICAP GAME DETECTED: ${gameData.handicap} stones`,
      );
    }

    // Get initial player (important for handicap games)
    const initialPlayer = gameData.initial_player || "black";
    logger.log(`[GameEngine] Initial player extracted: ${initialPlayer}`);
    logger.log(
      `[GameEngine] Handicap info: handicap=${gameData.handicap}, initial_state=`,
      gameData.initial_state,
    );

    const parsedMoves = this.parseGameMoves(gameData.moves, initialPlayer);

    // Parse clock data properly
    let clockData = null;
    if (gameData.clock) {
      clockData = this.parsePlayerClock(gameData.clock);
    }

    // Calculate current player based on initial player and moves count
    let currentPlayer;
    if (initialPlayer === "white") {
      // In handicap games where white plays first
      currentPlayer = parsedMoves.length % 2 === 0 ? "white" : "black";
    } else {
      // Normal games where black plays first
      currentPlayer = parsedMoves.length % 2 === 0 ? "black" : "white";
    }

    this.currentGame = {
      id: this.id,
      name: gameData.game_name,
      phase: gameData.phase,
      moves: parsedMoves,
      players: {
        black: {
          name: gameData.players.black.username,
          rank: gameData.players.black.rank,
          id: gameData.players.black.id,
        },
        white: {
          name: gameData.players.white.username,
          rank: gameData.players.white.rank,
          id: gameData.players.white.id,
        },
      },
      clock: clockData,
      currentPlayer: currentPlayer,
      finished: gameData.phase === "finished",
      captures: this.boardController.captures,
      // Store handicap information
      handicap: gameData.handicap || 0,
      initialPlayer: initialPlayer,
      initialState: gameData.initial_state || null,
    };

    logger.log(`[GameEngine] Game ${this.id} initialized:`, this.currentGame);

    // Log handicap information
    if (this.currentGame.handicap > 0) {
      logger.log(
        `[GameEngine] Handicap game: ${this.currentGame.handicap} stones, ${this.currentGame.initialPlayer} plays first`,
      );
    }

    // Debug: Check if initial_state was processed
    logger.log(
      `[GameEngine] Initial state in currentGame:`,
      this.currentGame.initialState,
    );

    // Initialize board state with handicap stones first, then moves
    this.boardController.resetBoard();

    // Place handicap stones if any
    logger.log(`[GameEngine] gameData.initial_state:`, gameData.initial_state);
    logger.log(`[GameEngine] gameData keys:`, Object.keys(gameData));

    if (gameData.initial_state) {
      logger.log(`[GameEngine] Calling placeHandicapStones...`);
      this.boardController.placeHandicapStones(gameData.initial_state);
    } else {
      logger.log(
        `[GameEngine] No initial_state found - no handicap stones to place`,
      );
      // Check if it might be under a different key
      if (gameData.initialState) {
        logger.log(
          `[GameEngine] Found initialState instead:`,
          gameData.initialState,
        );
        this.boardController.placeHandicapStones(gameData.initialState);
      }
    }

    // Then replay moves
    logger.log(
      `[GameEngine] Starting to replay ${parsedMoves.length} moves...`,
    );
    this.boardController.initializeFromMoves(parsedMoves);

    // Start clock if available
    if (clockData) {
      this.startClockCountdown();
    }

    // Update UI with current board state
    if (globalThis.uiManager) {
      globalThis.uiManager.updateUI(this.currentGame);
      // Also update board with actual state to show any captures that occurred during initialization
      globalThis.uiManager.updateBoard(
        this.currentGame.moves,
        this.boardController.getBoardState(),
      );
    }

    this.requestCurrentPositionAnalysis("initial-game-load");
    return this.currentGame;
  }

  // Initialize review data
  initializeReview(reviewData) {
    const filteredData = reviewData.filter((entry) => !entry.chat);
    const gameData = filteredData[0];
    const lastMove = filteredData[filteredData.length - 1];
    const moves = this.parseReviewMoves(lastMove.m);

    logger.log(`[GameEngine] === INITIAL REVIEW SETUP ===`);
    logger.log(`[GameEngine] Parsed ${moves.length} moves for initial setup`);

    // COMPLETE RESET - start from empty board
    this.boardController.resetBoard();
    logger.log(`[GameEngine] Board completely reset for initial review`);

    if (moves.length === 0) {
      logger.log(
        `[GameEngine] No moves for initial setup - board will remain empty`,
      );
    } else {
      // Replay ALL moves from beginning
      this.boardController.initializeFromMoves(moves);
    }

    // Get final state after complete replay
    const finalBoardState = this.boardController.getBoardState();
    const finalCaptures = this.boardController.captures;
    const totalStones =
      finalBoardState.flat().filter((cell) => cell !== 0).length;

    if (totalStones === 0) {
      logger.log(`[GameEngine] INITIAL FINAL STATE: Empty board (0 stones)`);
    } else {
      logger.log(
        `[GameEngine] INITIAL FINAL STATE: ${totalStones} stones on board`,
      );
    }
    logger.log(
      `[GameEngine] INITIAL FINAL CAPTURES: Black=${finalCaptures.black}, White=${finalCaptures.white}`,
    );

    // Build timestamp information from all review entries
    const timestamps = {};
    filteredData.forEach((entry) => {
      if (entry.ts && entry.m) {
        const entryMoves = this.parseReviewMoves(entry.m);
        if (entryMoves.length > 0) {
          timestamps[entryMoves.length] = entry.ts;
        }
      }
    });

    const outcome = gameData.gamedata?.outcome || gameData.gamedata?.winner || null;

    this.currentReview = {
      id: this.id,
      name: gameData.gamedata.game_name,
      moves: moves,
      outcome,
      winner: outcome,
      finished: Boolean(outcome),
      players: {
        black: {
          name: gameData.gamedata.players.black.name,
          rank: gameData.gamedata.players.black.rank,
        },
        white: {
          name: gameData.gamedata.players.white.name,
          rank: gameData.gamedata.players.white.rank,
        },
      },
      currentPlayer: moves.length % 2 === 0 ? "black" : "white",
      captures: finalCaptures,
      timestamps: timestamps,
      reviewEntries: filteredData, // Store original entries for time calculation
    };

    logger.log(
      `[GameEngine] Review ${this.id} initialized with ${moves.length} moves`,
    );

    // Update UI with final board state
    if (globalThis.uiManager) {
      globalThis.uiManager.updateUI(this.currentReview);
      logger.log(`[GameEngine] Initial UI update with final board state`);
      globalThis.uiManager.updateBoard(
        this.currentReview.moves,
        finalBoardState,
      );
    }

    this.requestCurrentPositionAnalysis("initial-review-load");
    logger.log(`[GameEngine] === INITIAL REVIEW SETUP COMPLETE ===`);
    return this.currentReview;
  }

  // Add move to game
  addGameMove(moveData) {
    if (!this.currentGame) return null;

    const moveNumber = this.currentGame.moves.length + 1;
    const currentColor = this.currentGame.currentPlayer;
    const parsedMove = this.parseSingleMove(
      moveData.move,
      currentColor,
      moveNumber,
    );

    this.currentGame.moves.push(parsedMove);

    // Update current player - always alternates regardless of handicap
    this.currentGame.currentPlayer = currentColor === "black"
      ? "white"
      : "black";

    // Update board state with new move
    let capturedCount = 0;
    if (parsedMove.move !== "pass") {
      const moveSuccess = this.boardController.playMove(
        parsedMove.coordinates[0],
        parsedMove.coordinates[1],
        parsedMove.color,
      );
      if (!moveSuccess) {
        logger.warn(`[GameEngine] Invalid move attempted: ${parsedMove.move}`);
        return null;
      }

      // Get capture information from the last move
      const lastMove = this.boardController
        .moveHistory[this.boardController.moveHistory.length - 1];
      if (lastMove && lastMove.captured) {
        capturedCount = lastMove.captured;
      }
    }

    // Update captures
    this.currentGame.captures = this.boardController.captures;

    // Add capture information to the parsed move
    parsedMove.captured = capturedCount;

    // Update UI with new move and turn change
    if (globalThis.uiManager) {
      // Pass the current board state to show captures
      globalThis.uiManager.updateBoard(
        this.currentGame.moves,
        this.boardController.getBoardState(),
      );
      globalThis.uiManager.updateScore(this.currentGame);
      globalThis.uiManager.updateTurnIndicator(this.currentGame.currentPlayer);

      // Log captures
      if (parsedMove.captured && parsedMove.captured > 0) {
        logger.log(`[GameEngine] ${parsedMove.captured} stones captured`);
      }
    }

    logger.log(`[GameEngine] Move added:`, parsedMove);

    // Auto-request analysis for new move
    this.requestCurrentPositionAnalysis("new-game-move");

    return parsedMove;
  }

  // Parse clock data from OGS format
  parsePlayerClock(clockData) {
    const parseJGOFClock = (jgofClock) => {
      if (!jgofClock || typeof jgofClock !== "object") {
        return { time: 0, periods: 0, periodTime: 0, period_time_left: 0 };
      }

      const thinkingTime = Math.max(
        0,
        Math.floor((jgofClock.thinking_time || 0) * 1000),
      );
      const periodTime = (jgofClock.period_time || 0) * 1000;

      // Use server's period_time_left if available, otherwise use full periodTime
      let periodTimeLeft = periodTime;
      if (jgofClock.period_time_left !== undefined) {
        periodTimeLeft = Math.max(
          0,
          Math.floor(jgofClock.period_time_left * 1000),
        );
      }

      return {
        time: thinkingTime,
        periods: jgofClock.periods || 0,
        periodTime: periodTime,
        period_time_left: periodTimeLeft,
      };
    };

    return {
      black: parseJGOFClock(clockData.black_time),
      white: parseJGOFClock(clockData.white_time),
      current_player: clockData.current_player,
      lastUpdate: Date.now(),
    };
  }

  // Update game clock
  updateGameClock(clockData) {
    if (!this.currentGame) return null;

    const previousCurrentPlayer = this.currentGame.clock
      ? this.currentGame.clock.current_player
      : null;
    const newClock = this.parsePlayerClock(clockData);

    // Add server timestamp for synchronization
    newClock.serverUpdate = Date.now();

    // Check if current player changed (indicates a move was played)
    const currentPlayerChanged =
      previousCurrentPlayer !== newClock.current_player;

    if (currentPlayerChanged) {
      // A move was played - reset opponent's byo-yomi period to full period time
      this.resetOpponentByoyomiPeriod(newClock);
      this.currentGame.clock = newClock;
      this.startClockCountdown();
    } else if (!this.clockInterval) {
      // No countdown running, start it
      this.currentGame.clock = newClock;
      this.startClockCountdown();
    } else {
      // Drift correction - adjust local clock to match server time
      this.applyClockDriftCorrection(newClock);

      // Update UI with current local time
      if (globalThis.uiManager) {
        globalThis.uiManager.updateClock(this.currentGame.clock);
      }
    }

    // Only log clock updates when current player changes (moves played)
    if (currentPlayerChanged) {
      logger.log(`[GameEngine] Clock updated:`, this.currentGame.clock);
    }
    return this.currentGame.clock;
  }

  // Reset opponent's byo-yomi period when a move is played
  resetOpponentByoyomiPeriod(newClock) {
    const currentPlayerById = newClock.current_player;

    // Determine which player is now to move (opponent of who just played)
    const players = this.currentGame.players;
    if (!players?.black || !players?.white) return;

    let currentPlayerColor = "black";
    if (currentPlayerById === players.white.id) {
      currentPlayerColor = "white";
    }

    // Reset current player's period to full period time if in byo-yomi
    const currentPlayerClock = newClock[currentPlayerColor];
    if (currentPlayerClock.periods > 0 && currentPlayerClock.time <= 0) {
      currentPlayerClock.period_time_left = currentPlayerClock.periodTime;
      logger.log(
        `[GameEngine] Reset ${currentPlayerColor}'s byo-yomi period to full time`,
      );
    }
  }

  // Apply drift correction to local clock
  applyClockDriftCorrection(serverClock) {
    if (!this.currentGame.clock) return;

    const currentPlayerById = this.currentGame.clock.current_player;
    const players = this.currentGame.players;
    if (!players?.black || !players?.white) return;

    let currentPlayerColor = "black";
    if (currentPlayerById === players.white.id) {
      currentPlayerColor = "white";
    }

    const localClock = this.currentGame.clock[currentPlayerColor];
    const serverPlayerClock = serverClock[currentPlayerColor];
    if (!localClock || !serverPlayerClock) return;

    // Calculate drift (difference between server and local time)
    let drift = 0;

    if (localClock.time > 0) {
      // In main thinking time
      drift = localClock.time - serverPlayerClock.time;
    } else if (localClock.periods > 0) {
      // In byo-yomi periods
      drift = localClock.period_time_left - serverPlayerClock.period_time_left;
    }

    // Apply drift correction if significant (>2 seconds)
    if (Math.abs(drift) > 2000) {
      logger.log(`[GameEngine] Applying drift correction: ${drift}ms`);

      if (localClock.time > 0) {
        localClock.time = serverPlayerClock.time;
      } else if (localClock.periods > 0) {
        localClock.period_time_left = serverPlayerClock.period_time_left;
        localClock.periods = serverPlayerClock.periods;
      }
    }
  }

  // Start clock countdown
  startClockCountdown() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }

    if (
      !this.currentGame || this.currentGame.finished || !this.currentGame.clock
    ) return;

    const currentPlayerById = this.currentGame.clock.current_player;
    const players = this.currentGame.players;
    if (!players?.black || !players?.white) return;

    let currentPlayer = "black";

    // Map player ID to color
    if (currentPlayerById === players.black.id) {
      currentPlayer = "black";
    } else if (currentPlayerById === players.white.id) {
      currentPlayer = "white";
    }

    this.clockInterval = setInterval(() => {
      if (!this.currentGame?.clock) return;
      const playerClock = this.currentGame.clock[currentPlayer];
      if (!playerClock) return;

      if (playerClock.time > 0) {
        playerClock.time -= 1000; // Decrease by 1 second

        // Emit clock update event
        this.callEventHandler("clock", this.currentGame.clock);

        // Call UIManager directly if available
        if (globalThis.uiManager) {
          globalThis.uiManager.updateClock(this.currentGame.clock);
        }

        if (playerClock.time <= 0) {
          logger.log(`[GameEngine] Time expired for ${currentPlayer}`);
          this.onTimeExpired(currentPlayer);
        }
      } else if (playerClock.periods > 0) {
        // Handle byo-yomi periods
        if (playerClock.period_time_left > 0) {
          playerClock.period_time_left -= 1000;

          // Emit clock update event
          this.callEventHandler("clock", this.currentGame.clock);

          // Call UIManager directly if available
          if (globalThis.uiManager) {
            globalThis.uiManager.updateClock(this.currentGame.clock);
          }

          if (playerClock.period_time_left <= 0) {
            // Period expired, use next period
            playerClock.periods--;
            if (playerClock.periods > 0) {
              playerClock.period_time_left = playerClock.periodTime;
              logger.log(
                `[GameEngine] Period expired for ${currentPlayer}, ${playerClock.periods} periods remaining`,
              );
            } else {
              logger.log(
                `[GameEngine] All periods expired for ${currentPlayer}`,
              );
              this.onTimeExpired(currentPlayer);
            }
          }
        } else {
          // No period time left and no periods remaining
          logger.log(`[GameEngine] All periods expired for ${currentPlayer}`);
          this.onTimeExpired(currentPlayer);
        }
      }
    }, 1000);
  }

  // Stop clock countdown
  stopClockCountdown() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  // Update game phase
  updateGamePhase(phase) {
    if (!this.currentGame) return null;

    this.currentGame.phase = phase;
    this.currentGame.finished = phase === "finished";

    if (phase === "finished") {
      this.stopClockCountdown();
    }

    // Update UI with phase change
    if (globalThis.uiManager) {
      globalThis.uiManager.updateGameStatus(this.currentGame);
    }

    logger.log(`[GameEngine] Game phase updated to:`, phase);
    return this.currentGame;
  }

  // Update review moves
  updateReviewMoves(moveString, timestamp) {
    if (!this.currentReview) return null;

    // Parse moves and update board state efficiently
    const moves = this.parseReviewMoves(moveString);

    // Complete reset and replay (this is necessary for reviews)
    this.boardController.resetBoard();

    if (moves.length > 0) {
      this.boardController.initializeFromMoves(moves);
    }

    // Get final state after replay
    const finalBoardState = this.boardController.getBoardState();
    const finalCaptures = this.boardController.captures;

    // Store timestamp information for the current move count
    if (!this.currentReview.timestamps) {
      this.currentReview.timestamps = {};
    }
    if (timestamp && moves.length > 0) {
      this.currentReview.timestamps[moves.length] = timestamp;
    }

    // Store the current move's timestamp for time calculation
    if (timestamp) {
      this.currentReview.lastMoveTimestamp = timestamp;
    }

    // Update review state with final results
    this.currentReview.moves = moves;
    this.currentReview.currentPlayer = moves.length % 2 === 0
      ? "black"
      : "white";
    this.currentReview.captures = finalCaptures;

    // Update UI with the final board state
    if (globalThis.uiManager) {
      globalThis.uiManager.updateBoard(
        this.currentReview.moves,
        finalBoardState,
      );
      globalThis.uiManager.updateScore(this.currentReview);
      globalThis.uiManager.updateTurnIndicator(
        this.currentReview.currentPlayer,
      );
    }

    // Auto-request analysis for review position
    this.requestCurrentPositionAnalysis("review-position-update");

    return this.currentReview.moves;
  }

  // Get current state (game or review)
  getCurrentState() {
    return this.type === "game" ? this.currentGame : this.currentReview;
  }

  // Get game state
  getGameState() {
    return this.currentGame;
  }

  // Get review state
  getReviewState() {
    return this.currentReview;
  }

  // Format time for display
  formatTime(timeData) {
    if (!timeData || typeof timeData !== "object") {
      return "00:00";
    }

    const totalSeconds = Math.floor(timeData.time / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // Show periods if in byo-yomi
    if (timeData.periods > 0 && timeData.time <= 0) {
      const periodTimeLeft = Math.floor(timeData.period_time_left / 1000);
      return `${periodTimeLeft} ${timeData.periods}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  // Board state access methods
  getBoardState() {
    return this.boardController.getBoardState();
  }

  getBoardString() {
    return this.boardController.getBoardString();
  }

  getStone(x, y) {
    return this.boardController.getStone(x, y);
  }

  getCaptures() {
    return this.boardController.captures;
  }

  getTerritory() {
    return this.boardController.getTerritory();
  }

  getBoardSize() {
    return this.boardController.size;
  }

  // Event handlers (override these in your implementation)
  onClockTick(clockData) {
    // Override this method to handle clock updates
    logger.log(`[GameEngine] Clock tick:`, {
      black: this.formatTime(clockData.black),
      white: this.formatTime(clockData.white),
    });
  }

  onTimeExpired(player) {
    // Override this method to handle time expiration
    logger.log(`[GameEngine] Time expired for ${player}`);
  }
}
class URLRouter {
  constructor() {
    this.routes = {};
  }

  // Parse current URL and extract type and ID
  parseURL() {
    const path = globalThis.location.pathname;
    const segments = path.split("/").filter((segment) => segment.length > 0);

    if (segments.length >= 2) {
      const rawType = segments[0]; // 'game', 'review', or legacy 'demo'
      const type = rawType === "demo" ? "review" : rawType;
      const id = parseInt(segments[1]); // game/review ID

      if ((type === "game" || type === "review") && !isNaN(id)) {
        if (rawType === "demo") {
          const normalizedUrl =
            `/review/${id}${globalThis.location.search}${globalThis.location.hash}`;
          globalThis.history.replaceState({ type, id }, "", normalizedUrl);
        }
        return { type, id };
      }
    }

    return null;
  }

  // Navigate to a specific game or review. Legacy demo IDs are OGS reviews.
  navigateTo(type, id) {
    const normalizedType = type === "demo" ? "review" : type;
    const url = `/${normalizedType}/${id}`;
    globalThis.history.pushState({ type: normalizedType, id }, "", url);
    this.handleRoute(normalizedType, id);
  }

  // Handle route changes
  handleRoute(type, id) {
    logger.log(`[Router] Navigating to ${type} ${id}`);

    // Create new GameEngine for the route
    if (GameEngine) {
      // Clean up existing GameEngine if any
      GameEngine.stopClockCountdown();
    }

    GameEngine = new GameEngineWrapper(type, id, OGS);
    globalThis.GameEngine = GameEngine; // Expose globally
    GameEngine.connect();
  }

  // Initialize router
  init() {
    // Handle back/forward browser navigation
    globalThis.addEventListener("popstate", (event) => {
      if (event.state && event.state.type && event.state.id) {
        this.handleRoute(event.state.type, event.state.id);
      } else {
        // Parse URL if no state
        const route = this.parseURL();
        if (route) {
          this.handleRoute(route.type, route.id);
        }
      }
    });

    // Handle initial page load
    const route = this.parseURL();
    if (route) {
      this.handleRoute(route.type, route.id);
    } else {
      logger.log(
        "[Router] No valid route found. Use format: /game/123456 or /review/123456",
      );
    }
  }
}

// GameEngine will be created when we know the type and ID

// OGS socket.io client
const OGS = io("https://online-go.com", {
  transports: ["websocket"],
});

logger.log(`[OGS-WS v${OGS_WS_VERSION}] OGS socket.io client created`);

// Connection event handlers (matching example.js exactly)
OGS.on("connect", () => {
  const client_name = "browser-" + Math.random().toString(36).substr(2, 9);
  logger.log("client:", client_name);
  logger.log("OGS connected");
  OGS.emit("hostinfo");
  OGS.emit("authenticate", { device_id: client_name });
});

// Global GameEngine instance
let GameEngine = null;

// Global AI Analysis Manager (can be used independently)
let AIAnalysis = null;

// Global AI Configuration
globalThis.AIAutoConnect = true; // Auto-connect to AI server when games start
globalThis.AIHostname = location.hostname; // Default AI server hostname
globalThis.AIPort = 8081; // Default AI server port
globalThis.AIMaxVisits = 100; // Default max visits for analysis

// Create router instance
const router = new URLRouter();

// Global navigation functions for easy use
globalThis.navigateToGame = (gameId) => {
  router.navigateTo("game", gameId);
};

globalThis.navigateToReview = (reviewId) => {
  router.navigateTo("review", reviewId);
};

globalThis.navigateToDemo = (demoId) => {
  router.navigateTo("review", demoId);
};

// Expose router globally
globalThis.router = router;

// Global AI analysis functions
globalThis.connectToAI = (
  hostname = globalThis.AIHostname,
  port = globalThis.AIPort,
) => {
  logger.log(`[AI] Connecting to AI server at ${hostname}:${port}`);
  if (GameEngine) {
    GameEngine.connectToAI(hostname, port);
  } else {
    logger.log("[AI] No active game. Creating standalone AI connection...");
    AIAnalysis = new AIAnalysisManager(hostname, port);
    AIAnalysis.connect();
  }
};

globalThis.disconnectFromAI = () => {
  logger.log("[AI] Disconnecting from AI server");
  if (GameEngine) {
    GameEngine.disconnectFromAI();
  }
  if (AIAnalysis) {
    AIAnalysis.disconnect();
    AIAnalysis = null;
  }
};

globalThis.requestAnalysis = (moveNumber = null) => {
  if (GameEngine) {
    logger.log(`[AI] Requesting analysis for move ${moveNumber || "current"}`);
    return GameEngine.requestAnalysis(moveNumber);
  } else {
    logger.log("[AI] No active game. Cannot request analysis.");
    return false;
  }
};

globalThis.setAIMaxVisits = (visits) => {
  logger.log(`[AI] Setting max visits to ${visits}`);
  globalThis.AIMaxVisits = visits; // Update global setting
  if (GameEngine) {
    GameEngine.setAIMaxVisits(visits);
  }
  if (AIAnalysis) {
    AIAnalysis.setMaxVisits(visits);
  }
};

globalThis.getAIStatus = () => {
  if (GameEngine) {
    return GameEngine.getAIStatus();
  }
  if (AIAnalysis) {
    return {
      connected: AIAnalysis.isConnected(),
      pendingAnalyses: AIAnalysis.getPendingAnalysisCount(),
      maxVisits: AIAnalysis.maxVisits,
    };
  }
  return { connected: false, pendingAnalyses: 0, maxVisits: 0 };
};

// AI Configuration functions
globalThis.enableAIAutoConnect = () => {
  globalThis.AIAutoConnect = true;
  logger.log("[AI] Auto-connect enabled");
};

globalThis.disableAIAutoConnect = () => {
  globalThis.AIAutoConnect = false;
  logger.log("[AI] Auto-connect disabled");
};

globalThis.setAIServer = (hostname, port = 8081) => {
  globalThis.AIHostname = hostname;
  globalThis.AIPort = port;
  logger.log(`[AI] Server settings updated: ${hostname}:${port}`);
};

// Quick connect function for hostname:8081
globalThis.connectToLocalAI = () => {
  globalThis.connectToAI(location.hostname, 8081);
};

OGS.on("hostinfo", (hostinfo) => {
  logger.log("Termination server", hostinfo);

  // OGS connection validated - initialize router
  router.init();
});

// Game and review connection is now handled by GameEngineWrapper

// OGS doesn't return authentication - we don't need to wait for it
OGS.on("authenticate", (auth) => {
  logger.log("Authentication event (not needed for connection):", auth);
});

OGS.on("disconnect", () => {
  logger.log("Disconnected from OGS. Attempting to reconnect...");
});

OGS.on("error", (error) => {
  logger.error("Socket connection error:", error);
});

// Filter out active-bots messages
OGS.on("active-bots", (_data) => {
  // Skip logging active-bots messages
});

logger.log(`[OGS-WS v${OGS_WS_VERSION}] Event handlers set up`);

// AI Analysis Help
globalThis.showAIHelp = () => {
  logger.log(`
🤖 AI Analysis Functions:

Basic Usage:
      connectToAI()           - Connect to AI server (hostname:8081 by default)
    connectToLocalAI()      - Quick connect to hostname:8081
  disconnectFromAI()      - Disconnect from AI server
  requestAnalysis()       - Request analysis for current position
  getAIStatus()          - Check AI connection and queue status

Configuration:
  setAIServer(host, port) - Set AI server address
  setAIMaxVisits(visits)  - Set analysis strength (default: 100)
  enableAIAutoConnect()   - Auto-connect when games start
  disableAIAutoConnect()  - Disable auto-connect

Current Settings:
  Auto-connect: ${globalThis.AIAutoConnect}
  Server: ${globalThis.AIHostname}:${globalThis.AIPort}
  Max visits: ${globalThis.AIMaxVisits}

Examples:
  setAIServer('192.168.1.100', 8081)  // Connect to remote server
  setAIMaxVisits(200)                 // Stronger analysis
  requestAnalysis()                   // Analyze current position
    `);
};

logger.log(
  `[AI] 🤖 AI Analysis ready! Default server: ${globalThis.AIHostname}:${globalThis.AIPort}`,
);
logger.log(`[AI] 💡 Type showAIHelp() for usage instructions`);

// Test function for handicap stone parsing
globalThis.testHandicapParsing = () => {
  logger.log("=== Testing Handicap Stone Parsing ===");

  // Test the initial_state parsing with example data
  const testState = { black: "pppddp", white: "" };

  if (GameEngine && GameEngine.boardController) {
    logger.log("Testing with example state:", testState);
    const result = GameEngine.boardController.parseInitialStateString(
      testState.black,
    );
    logger.log("Parsed coordinates:", result);

    // Expected: "pp"=[15,15], "pd"=[15,3], "dp"=[3,15]
    const expected = [
      { x: 15, y: 15 }, // pp
      { x: 15, y: 3 }, // pd
      { x: 3, y: 15 }, // dp
    ];

    logger.log("Expected coordinates:", expected);

    if (JSON.stringify(result) === JSON.stringify(expected)) {
      logger.log("✅ Handicap parsing test PASSED");
    } else {
      logger.log("❌ Handicap parsing test FAILED");
    }
  } else {
    logger.log("GameEngine not available for testing");
  }
};

logger.log(
  `[Test] 💡 Type testHandicapParsing() to test handicap stone parsing`,
);

// Function to check current game state for handicap info
globalThis.checkHandicapInfo = () => {
  logger.log("=== Checking Current Game Handicap Info ===");

  if (GameEngine && GameEngine.currentGame) {
    logger.log("Current game:", GameEngine.currentGame);
    logger.log("Handicap:", GameEngine.currentGame.handicap);
    logger.log("Initial player:", GameEngine.currentGame.initialPlayer);
    logger.log("Initial state:", GameEngine.currentGame.initialState);

    if (GameEngine.boardController) {
      logger.log("Board state after initialization:");
      logger.log(GameEngine.boardController.getBoardString());
    }
  } else {
    logger.log("No active game found");
  }
};

logger.log(
  `[Test] 💡 Type checkHandicapInfo() to check current game handicap info`,
);

// Function to manually test handicap stone placement
globalThis.testHandicapPlacement = () => {
  logger.log("=== Testing Handicap Stone Placement ===");

  if (GameEngine && GameEngine.boardController) {
    // Test with the example data from earlier
    const testInitialState = { black: "pppddp", white: "" };
    logger.log("Testing with:", testInitialState);

    // Reset board
    GameEngine.boardController.resetBoard();
    logger.log("Board reset");

    // Place handicap stones
    GameEngine.boardController.placeHandicapStones(testInitialState);
    logger.log("Handicap stones placed");

    // Show board state
    logger.log("Board after handicap placement:");
    logger.log(GameEngine.boardController.getBoardString());

    // Count stones
    const boardState = GameEngine.boardController.getBoardState();
    const blackStones = boardState.flat().filter((cell) => cell === 1).length;
    const whiteStones = boardState.flat().filter((cell) => cell === 2).length;
    logger.log(`Black stones: ${blackStones}, White stones: ${whiteStones}`);
  } else {
    logger.log("GameEngine not available");
  }
};

logger.log(
  `[Test] 💡 Type testHandicapPlacement() to test handicap stone placement`,
);

// Function to inspect raw game data for handicap info
globalThis.inspectGameData = () => {
  logger.log("=== Inspecting Raw Game Data ===");

  // Try to get the raw game data from the last received event
  if (globalThis.lastGameData) {
    logger.log("Last received game data:", globalThis.lastGameData);
    logger.log("Handicap:", globalThis.lastGameData.handicap);
    logger.log("Initial player:", globalThis.lastGameData.initial_player);
    logger.log("Initial state:", globalThis.lastGameData.initial_state);
  } else {
    logger.log("No raw game data available");

    // Try to get from GameEngine
    if (GameEngine && GameEngine.currentGame) {
      logger.log("Current game data:", GameEngine.currentGame);
    }
  }
};

logger.log(`[Test] 💡 Type inspectGameData() to inspect raw game data`);

// Function to check if current game is a handicap game
globalThis.isHandicapGame = () => {
  logger.log("=== Checking if Current Game is Handicap ===");

  if (globalThis.lastGameData) {
    const handicap = globalThis.lastGameData.handicap || 0;
    const initialState = globalThis.lastGameData.initial_state;

    logger.log(`Handicap: ${handicap}`);
    logger.log(`Initial state:`, initialState);

    if (handicap > 0) {
      logger.log(`✅ This IS a handicap game with ${handicap} stones`);
      logger.log(`Initial player: ${globalThis.lastGameData.initial_player}`);

      if (initialState && (initialState.black || initialState.white)) {
        logger.log(`✅ Has initial stones:`, initialState);
      } else {
        logger.log(`❌ No initial stones found`);
      }
    } else {
      logger.log(`❌ This is NOT a handicap game (handicap = 0)`);
    }
  } else {
    logger.log("No game data available");
  }
};

logger.log(
  `[Test] 💡 Type isHandicapGame() to check if current game is handicap`,
);

// Function to test handicap parsing with example data
globalThis.testHandicapExample = () => {
  logger.log("=== Testing Handicap with Example Data ===");

  // Example data from the earlier game
  const exampleGameData = {
    handicap: 3,
    initial_player: "white",
    initial_state: { black: "pppddp", white: "" },
  };

  logger.log("Example game data:", exampleGameData);

  // Test the parsing
  if (GameEngine && GameEngine.boardController) {
    logger.log("Testing handicap stone placement...");

    // Reset board
    GameEngine.boardController.resetBoard();

    // Place handicap stones
    GameEngine.boardController.placeHandicapStones(
      exampleGameData.initial_state,
    );

    // Show results
    logger.log("Board after handicap placement:");
    logger.log(GameEngine.boardController.getBoardString());

    // Count stones
    const boardState = GameEngine.boardController.getBoardState();
    const blackStones = boardState.flat().filter((cell) => cell === 1).length;
    const whiteStones = boardState.flat().filter((cell) => cell === 2).length;
    logger.log(`Black stones: ${blackStones}, White stones: ${whiteStones}`);

    if (blackStones === 3) {
      logger.log("✅ Handicap stone placement test PASSED");
    } else {
      logger.log("❌ Handicap stone placement test FAILED");
    }
  } else {
    logger.log("GameEngine not available");
  }
};

logger.log(
  `[Test] 💡 Type testHandicapExample() to test with example handicap data`,
);

// Function to test coordinate parsing specifically
globalThis.testCoordinateParsing = () => {
  logger.log("=== Testing Coordinate Parsing ===");

  // Test the 2-stone handicap example
  const testString = "pddp";
  logger.log(`Testing string: "${testString}"`);

  if (GameEngine && GameEngine.boardController) {
    const result = GameEngine.boardController.parseInitialStateString(
      testString,
    );
    logger.log("Parsed coordinates:", result);

    // Expected: "pd" = Q16, "dp" = D4
    const expected = [
      { x: 15, y: 3 }, // pd -> Q16
      { x: 3, y: 15 }, // dp -> D4
    ];

    logger.log("Expected coordinates:", expected);

    if (JSON.stringify(result) === JSON.stringify(expected)) {
      logger.log("✅ Coordinate parsing test PASSED");
    } else {
      logger.log("❌ Coordinate parsing test FAILED");
    }
  } else {
    logger.log("GameEngine not available");
  }
};

logger.log(
  `[Test] 💡 Type testCoordinateParsing() to test coordinate parsing`,
);

// Function to debug coordinate mapping
globalThis.debugCoordinateMapping = () => {
  logger.log("=== Debugging Coordinate Mapping ===");

  const letters = "abcdefghjklmnopqrst";
  logger.log("Letter mapping:", letters);

  // Test specific coordinates
  const testCoords = [
    { char: "p", expected: "Q16", x: 15, y: 3 },
    { char: "d", expected: "D4", x: 3, y: 15 },
  ];

  testCoords.forEach((coord) => {
    const index = letters.indexOf(coord.char);
    const letter = letters[index];
    const number = 19 - coord.y;
    const result = `${letter}${number}`;

    logger.log(
      `${coord.char} -> index ${index} -> ${result} (expected ${coord.expected})`,
    );
    logger.log(`  Expected: [${coord.x}, ${coord.y}] -> ${coord.expected}`);
    logger.log(`  Actual:   [${index}, ${coord.y}] -> ${result}`);
  });

  // Check if the issue is with the letter mapping
  logger.log("Checking letter positions:");
  logger.log("p position:", letters.indexOf("p"), "(should be 15 for Q16)");
  logger.log("q position:", letters.indexOf("q"), "(should be 16 for R16)");
  logger.log("d position:", letters.indexOf("d"), "(should be 3 for D4)");
};

logger.log(
  `[Test] 💡 Type debugCoordinateMapping() to debug coordinate mapping`,
);

// Function to test actual coordinate mapping for hoshi positions
globalThis.testHoshiPositions = () => {
  logger.log("=== Testing Hoshi Positions for Handicap Stones ===");

  const letters = "abcdefghjklmnopqrst";

  // Standard hoshi positions on 19x19 board
  const hoshiPositions = [
    { name: "4-4", x: 3, y: 3, expected: "D16" },
    { name: "4-16", x: 3, y: 15, expected: "D4" },
    { name: "10-10", x: 9, y: 9, expected: "J10" },
    { name: "16-4", x: 15, y: 3, expected: "P16" },
    { name: "16-16", x: 15, y: 15, expected: "P4" },
  ];

  logger.log("Testing hoshi positions:");
  hoshiPositions.forEach((pos) => {
    const x_letter = letters[pos.x];
    const y_number = 19 - pos.y;
    const result = `${x_letter}${y_number}`;
    logger.log(
      `${pos.name}: [${pos.x}, ${pos.y}] -> ${result} (expected ${pos.expected})`,
    );
  });

  // Test the actual handicap string "pddp"
  logger.log('\nTesting actual handicap string "pddp":');
  const testString = "pddp";
  for (let i = 0; i < testString.length; i += 2) {
    if (i + 1 < testString.length) {
      const char1 = testString[i];
      const char2 = testString[i + 1];
      const x_index = letters.indexOf(char1);
      const y_index = letters.indexOf(char2);
      const x_letter = letters[x_index];
      const y_number = 19 - y_index;
      const result = `${x_letter}${y_number}`;
      logger.log(
        `"${char1}${char2}" -> [${x_index}, ${y_index}] -> ${result}`,
      );
    }
  }

  // Check what the correct 2-stone handicap positions should be
  logger.log("\nExpected 2-stone handicap positions:");
  logger.log("- Q16 (16th line from left, 4th line from top)");
  logger.log("- D4 (4th line from left, 16th line from top)");

  // Calculate what coordinates these should be
  const q16_x = letters.indexOf("q"); // should be 15
  const q16_y = 3; // 4th line from top = index 3
  const d4_x = letters.indexOf("d"); // should be 3
  const d4_y = 15; // 16th line from top = index 15

  logger.log(`Q16 should be: [${q16_x}, ${q16_y}] -> q${19 - q16_y}`);
  logger.log(`D4 should be: [${d4_x}, ${d4_y}] -> d${19 - d4_y}`);
};

logger.log(`[Test] 💡 Type testHoshiPositions() to test hoshi positions`);
