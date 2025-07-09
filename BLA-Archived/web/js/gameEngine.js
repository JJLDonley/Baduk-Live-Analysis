/**
 * Frontend Game Engine
 * Handles game state, board logic, moves, and player data
 */
class GameEngine {
    constructor(analysisConnection) {
        this.analysisConnection = analysisConnection;
        this.games = new Map();
        this.currentGame = null;
        this.board = new Board();
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        // Setup event handlers
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.eventCallbacks.set('gameData', []);
        this.eventCallbacks.set('move', []);
        this.eventCallbacks.set('clock', []);
        this.eventCallbacks.set('gameFinished', []);
        this.eventCallbacks.set('analysisReady', []);
    }

    // Event callback management
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }

    emit(event, ...args) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in event callback for ${event}:`, error);
                }
            });
        }
    }

    onOGSReady() {
        console.log('[GameEngine] OGS connection ready');
        this.emit('ogsReady');
    }

    handleGameData(gameId, gameType, data) {
        console.log(`[GameEngine] Processing game data for ${gameType} ${gameId}`);
        
        // Create or update game
        const game = this.createOrUpdateGame(gameId, gameType, data);
        this.currentGame = game;
        
        // Process moves
        if (data.moves && data.moves.length > 0) {
            game.moves = this.formatMoves(data.moves);
            game.currentMove = game.moves.length;
            
            // Update board state
            this.updateBoardState(game);
            
            // Request analysis for current position
            this.requestAnalysis(game);
        } else {
            // Empty board - still request analysis for initial position
            game.moves = [];
            game.currentMove = 0;
            this.requestAnalysis(game);
        }
        
        // Emit game data event
        this.emit('gameData', game);
    }

    handleReviewData(reviewId, gameType, data) {
        console.log(`[GameEngine] Processing review data for ${reviewId}`);
        
        // Handle review data (similar to game data but with different structure)
        if (data && data.length > 0) {
            const reviewData = data[0];
            const gameData = reviewData.gamedata || reviewData;
            
            this.handleGameData(reviewId, gameType, gameData);
        }
    }

    handleMove(gameId, moveData) {
        console.log(`[GameEngine] Processing move for game ${gameId}:`, moveData);
        
        const game = this.games.get(gameId);
        if (!game) {
            console.error(`[GameEngine] Game ${gameId} not found`);
            return;
        }
        
        // Add move to game
        const formattedMove = this.formatSingleMove(moveData);
        game.moves.push(formattedMove);
        game.currentMove = game.moves.length;
        
        // Update board state
        this.updateBoardState(game);
        
        // Request analysis for new position
        this.requestAnalysis(game);
        
        // Emit move event
        this.emit('move', game, formattedMove);
    }

    handleClock(gameId, clockData) {
        console.log(`[GameEngine] Processing clock for game ${gameId}:`, clockData);
        
        const game = this.games.get(gameId);
        if (!game) {
            console.error(`[GameEngine] Game ${gameId} not found`);
            return;
        }
        
        // Update clock data
        game.clock = {
            current: clockData.current_player,
            black: clockData.black_time,
            white: clockData.white_time,
            timestamp: Date.now()
        };
        
        // Emit clock event
        this.emit('clock', game, clockData);
    }

    createOrUpdateGame(gameId, gameType, data) {
        let game = this.games.get(gameId);
        
        if (!game) {
            game = {
                id: gameId,
                type: gameType,
                moves: [],
                currentMove: 0,
                boardState: this.board.createEmptyState(),
                players: {
                    black: {
                        name: 'Black',
                        rank: '',
                        winrate: 50
                    },
                    white: {
                        name: 'White', 
                        rank: '',
                        winrate: 50
                    }
                },
                metadata: {
                    width: 19,
                    height: 19,
                    komi: 7.5,
                    handicap: 0,
                    rules: 'chinese',
                    phase: 'play'
                },
                clock: null,
                analysis: null,
                uuid: this.generateUUID()
            };
            
            this.games.set(gameId, game);
        }
        
        // Update game data
        if (data.width) game.metadata.width = data.width;
        if (data.height) game.metadata.height = data.height;
        if (data.komi !== undefined) game.metadata.komi = data.komi;
        if (data.handicap !== undefined) game.metadata.handicap = data.handicap;
        if (data.rules) game.metadata.rules = data.rules;
        if (data.phase) game.metadata.phase = data.phase;
        
        // Update players
        if (data.players) {
            if (data.players.black) {
                game.players.black.name = data.players.black.username || data.players.black.name || 'Black';
                game.players.black.rank = data.players.black.rank || '';
            }
            if (data.players.white) {
                game.players.white.name = data.players.white.username || data.players.white.name || 'White';
                game.players.white.rank = data.players.white.rank || '';
            }
        }
        
        // Update clock if present
        if (data.clock) {
            game.clock = {
                current: data.clock.current_player,
                black: data.clock.black_time,
                white: data.clock.white_time,
                timestamp: Date.now()
            };
        }
        
        return game;
    }

    formatMoves(moves) {
        return moves.map(move => this.formatSingleMove(move));
    }

    formatSingleMove(move) {
        // Handle different move formats from OGS
        if (Array.isArray(move)) {
            // Format: [x, y] or [x, y, timestamp]
            if (move.length >= 2) {
                return {
                    color: this.getCurrentPlayer(),
                    x: move[0],
                    y: move[1],
                    timestamp: move[2] || Date.now()
                };
            }
        } else if (typeof move === 'object') {
            // Format: {x: 1, y: 2, color: 'b'}
            return {
                color: move.color || this.getCurrentPlayer(),
                x: move.x,
                y: move.y,
                timestamp: move.timestamp || Date.now()
            };
        }
        
        return null;
    }

    getCurrentPlayer() {
        if (!this.currentGame) return 'b';
        return this.currentGame.moves.length % 2 === 0 ? 'b' : 'w';
    }

    updateBoardState(game) {
        // Reset board
        game.boardState = this.board.createEmptyState();
        
        // Apply all moves
        for (const move of game.moves) {
            this.board.playMove(game.boardState, move);
        }
    }

    requestAnalysis(game) {
        if (!this.analysisConnection) {
            console.warn('[GameEngine] No analysis connection available');
            return;
        }
        
        console.log(`[GameEngine] Requesting analysis for game ${game.id}, move ${game.currentMove}`);
        
        // Format moves for KataGo
        const katagoMoves = this.formatMovesForKataGo(game.moves);
        
        const analysisRequest = {
            gameId: game.id,
            gameType: game.type,
            moveNumber: game.currentMove,
            moves: katagoMoves,
            metadata: game.metadata,
            timestamp: Date.now()
        };
        
        this.analysisConnection.requestAnalysis(analysisRequest);
    }

    formatMovesForKataGo(moves) {
        return moves.map(move => {
            if (move.x === 'pass' || move.y === 'pass') {
                return [move.color, 'pass'];
            }
            
            // Convert coordinates to KataGo format
            const letters = 'ABCDEFGHJKLMNOPQRST';
            const x = letters[move.x] || letters[0];
            const y = (19 - move.y) || 19;
            
            return [move.color, `${x}${y}`];
        });
    }

    handleAnalysisResult(analysisResult) {
        console.log(`[GameEngine] Received analysis result:`, analysisResult);
        
        const game = this.games.get(analysisResult.gameId);
        if (!game) {
            console.error(`[GameEngine] Game ${analysisResult.gameId} not found for analysis`);
            return;
        }
        
        // Store analysis result
        game.analysis = analysisResult;
        
        // Update player winrates if available
        if (analysisResult.winrate) {
            game.players.black.winrate = analysisResult.winrate.black || 50;
            game.players.white.winrate = analysisResult.winrate.white || 50;
        }
        
        // Emit analysis ready event
        this.emit('analysisReady', game, analysisResult);
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Public API methods
    getCurrentGame() {
        return this.currentGame;
    }

    getGame(gameId) {
        return this.games.get(gameId);
    }

    getAllGames() {
        return Array.from(this.games.values());
    }

    getGameState() {
        if (!this.currentGame) return null;
        
        return {
            id: this.currentGame.id,
            type: this.currentGame.type,
            moves: this.currentGame.moves,
            currentMove: this.currentGame.currentMove,
            boardState: this.currentGame.boardState,
            players: this.currentGame.players,
            metadata: this.currentGame.metadata,
            clock: this.currentGame.clock,
            analysis: this.currentGame.analysis
        };
    }
}

/**
 * Board logic for game state management
 */
class Board {
    constructor() {
        this.size = 19;
    }

    createEmptyState() {
        return Array.from({ length: this.size }, () => 
            Array.from({ length: this.size }, () => '')
        );
    }

    playMove(boardState, move) {
        if (!move || move.x < 0 || move.x >= this.size || move.y < 0 || move.y >= this.size) {
            return;
        }

        if (move.x === 'pass' || move.y === 'pass') {
            return; // Pass move
        }

        const { color, x, y } = move;
        const oppositeColor = color === 'b' ? 'w' : 'b';

        // Place stone
        boardState[y][x] = color;

        // Remove captured groups
        this.removeCaptures(boardState, x, y, oppositeColor);
        
        // Check for suicide (and remove if necessary)
        if (this.isCapture(boardState, x, y, color)) {
            boardState[y][x] = ''; // Remove suicidal stone
        }
    }

    removeCaptures(boardState, x, y, opponentColor) {
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
                if (boardState[ny][nx] === opponentColor) {
                    const group = this.getGroup(boardState, nx, ny, opponentColor);
                    if (this.getLiberties(boardState, group).length === 0) {
                        // Remove captured group
                        for (const [gx, gy] of group) {
                            boardState[gy][gx] = '';
                        }
                    }
                }
            }
        }
    }

    getGroup(boardState, x, y, color) {
        const group = [];
        const visited = new Set();
        const stack = [[x, y]];
        
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            
            if (cx < 0 || cx >= this.size || cy < 0 || cy >= this.size) continue;
            if (boardState[cy][cx] !== color) continue;
            
            group.push([cx, cy]);
            
            // Add adjacent points
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dx, dy] of directions) {
                stack.push([cx + dx, cy + dy]);
            }
        }
        
        return group;
    }

    getLiberties(boardState, group) {
        const liberties = new Set();
        
        for (const [x, y] of group) {
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
                    if (boardState[ny][nx] === '') {
                        liberties.add(`${nx},${ny}`);
                    }
                }
            }
        }
        
        return Array.from(liberties).map(lib => {
            const [x, y] = lib.split(',').map(Number);
            return [x, y];
        });
    }

    isCapture(boardState, x, y, color) {
        const group = this.getGroup(boardState, x, y, color);
        return this.getLiberties(boardState, group).length === 0;
    }
}

export { GameEngine, Board }; 