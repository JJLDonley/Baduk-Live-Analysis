const { v4: uuidv4 } = require("uuid");
const { OGS, BES, GAMES } = require("./constants.js");
const { GameEntity } = require("./game.js");

class OGSConnection {
    constructor(queue, ai) {
        this.queue = queue;
        this.ai = ai;
        this.setupMainListeners();
    }

    setupMainListeners() {
        OGS.on("connect", () => {
            const client_name = uuidv4();
            console.log("client:", client_name);
            console.log("OGS connected");
            OGS.emit("hostinfo");
            OGS.emit("authenticate", { device_id: client_name });
        });

        OGS.on("hostinfo", (hostinfo) => {
            console.log("Termination server", hostinfo);

            if (GAMES && Object.keys(GAMES).length > 0) {
                console.log("Detected games in the GAMES object. Reconnecting...");
                Object.keys(GAMES).forEach((gameId) => {
                    const game = GAMES[gameId];
                    this.connectLiveGame(game.type, game.id);
                });
            }
        });

        OGS.on("authenticate", (auth) => {
            console.log(auth);
        });

        OGS.on("disconnect", () => {
            console.log("Disconnected from OGS. Attempting to reconnect...");
        });

        OGS.on("error", (error) => {
            console.error("Socket connection error:", error);
        });

        // Socket.io connection for frontend
        BES.on("connection", (socket) => {
            socket.on("subscribe", (game_id) => {
                const id = game_id["id"];
                const type = game_id["type"];
                console.log(`[OGS] Frontend subscribing to ${type} ${id}`);

                if (GAMES[id]) {
                    const game = GAMES[id];
                    console.log(`[OGS] Game ${id} found, type: ${game.type}, moves: ${game.moves.length}`);
                    
                    const gameEmitID = `${game.type}/${game.id}`;
                    game.state = game.board.state(game.moves);
                    
                    if (game.moves.length > 0) {
                        game.last.move = game.moves[game.moves.length - 1];
                        game.lastMoveToArrayCoordinates();
                    }
                    
                    // Get the current analysis if available
                    const currentAnalysis = game.getCurrentAnalysis();
                    
                    if (currentAnalysis) {
                        console.log(`[OGS] Sending existing analysis for game ${id}`);
                        // Send existing analysis data with proper metadata
                        const payload = {
                            type: gameEmitID,
                            data: game.data(),
                            analysisId: currentAnalysis.id,
                            gameType: currentAnalysis.type,
                            gameId: currentAnalysis.gameId,
                            moveNumber: currentAnalysis.moveNumber,
                            timestamp: currentAnalysis.timestamp
                        };
                        
                        BES.emit(gameEmitID, JSON.stringify(payload));
                    } else {
                        console.log(`[OGS] No analysis found, triggering new analysis for game ${id}`);
                        // No analysis yet, trigger initial analysis
                        const UUID = game.uuid;
                        const QUERIES = game.queries;
                        const MOVES = game.moves;
                        this.queue.process(game, UUID, QUERIES, MOVES, this.ai, BES);
                        game.queries++;
                    }
                    
                    // Send board state
                    const boardPayload = { 
                        board: game.state, 
                        move: game.moves.length > 0 ? [game.last.move[1], game.last.move[2]] : [] 
                    };
                    
                    BES.emit(`board/${id}`, JSON.stringify(boardPayload));
                } else {
                    console.log(`[OGS] Game ${id} not found, connecting to ${type} ${id}`);
                    this.connectLiveGame(type, id);
                }
            });

            socket.on("disconnect", () => {});
        });
    }

    connectLiveGame(type, id) {
        console.log(`[OGS] Connecting to ${type} ${id}`);
        if (!GAMES[id]) {
            GAMES[id] = {};
        }

        switch (type) {
            case "game":
                console.log(`[OGS] Calling connectGame for ${id}`);
                this.connectGame(id);
                break;
            case "review":
                console.log(`[OGS] Calling connectReview for ${id}`);
                this.connectReview(id);
                break;
            default:
                console.log(`[OGS] Invalid type: ${type}`);
                return;
        }
    }

    connectGame(id) {
        OGS.emit("game/connect", {
            game_id: id,
            chat: false,
        });

        OGS.on("game/" + id + "/gamedata", (data) => {
            console.log(`[OGS] Received gamedata for game ${id}`);
            console.log(`[OGS] Game phase: ${data.phase}`);
            console.log(`[OGS] Game moves count: ${data.moves ? data.moves.length : 0}`);
            
            if (data.phase === "finished") {
                console.log(`[OGS] Game ${id} is finished, disconnecting`);
                OGS.send(["game/disconnect", { game_id: id }]);

                const MOVES = this.formatGameStateData("game", data);
                const payload = {
                    board: GAMES[id].board.state(MOVES),
                    move: data.moves[data.moves.length - 1],
                };
                BES.emit(`board/${id}`, JSON.stringify(payload));
                return;
            }

            const MOVES = this.formatGameStateData("game", data);
            if (MOVES == undefined) {
                console.log(`[OGS] No moves available for game ${id}`);
                return;
            }

            console.log(`[OGS] Formatted moves count: ${MOVES.length}`);
            console.log(`[OGS] Triggering analysis for game ${id}`);
            
            // Always trigger analysis for initial position
            const UUID = GAMES[id].uuid;
            const QUERIES = GAMES[id].queries;
            this.queue.process(GAMES[id], UUID, QUERIES, MOVES, this.ai, BES);
            GAMES[id].queries++;
            this.setupGameListeners(id);
            
            // Send initial game metadata immediately
            this.sendInitialGameMetadata(id, data);
            
            // Send initial board state
            const boardPayload = {
                board: GAMES[id].board.state(MOVES),
                move: data.moves && data.moves.length > 0 ? data.moves[data.moves.length - 1] : [],
            };
            BES.emit(`board/${id}`, JSON.stringify(boardPayload));
        });
    }

    connectReview(id) {
        OGS.emit("review/connect", {
            review_id: id,
            chat: false,
        });

        OGS.on("review/" + id + "/full_state", (data) => {
            if (data[0].gamedata.game_id) {
                console.log("failed to connect Please use a demo board game or live game");
                BES.emit("error", {
                    err: "please use a demo board review. Game reviews are not permitted",
                });
                return;
            }

            const MOVES = this.formatGameStateData("review", data);
            // Note: MOVES can be an empty array for demo boards with no moves
            
            // Always trigger analysis for initial position (even if empty)
            const UUID = GAMES[id].uuid;
            const QUERIES = GAMES[id].queries;
            this.queue.process(GAMES[id], UUID, QUERIES, MOVES, this.ai, BES);
            GAMES[id].queries++;
            this.setupReviewListeners(id);

            // Send initial game metadata for review immediately
            this.sendInitialReviewMetadata(id, data);

            // Send initial board state (handle empty moves)
            const boardPayload = { 
                board: GAMES[id].board.state(MOVES), 
                move: MOVES.length > 0 ? MOVES[MOVES.length - 1] : []
            };
            BES.emit(`board/${id}`, JSON.stringify(boardPayload));
        });
    }

    setupGameListeners(id) {
        if (GAMES[id] && GAMES[id].listenersSet) return;

        OGS.on("game/" + id + "/move", (data) => {
            if (!data.move || data.move[0] == -1) return;
            
            let list = GAMES[id].liveMoves;
            const currentColor = list.length % 2 == 0 ? "b" : "w";
            const MOVE = this.formatGameMoveData("move", data.move, currentColor);
            list.push(MOVE);
            
            const MOVES = list;
            const UUID = GAMES[id].uuid;
            const QUERIES = GAMES[id].queries;
            GAMES[id].liveMoves = list;
            this.queue.process(GAMES[id], UUID, QUERIES, MOVES, this.ai, BES);
            GAMES[id].queries++;

            const payload = { 
                board: GAMES[id].board.state(MOVES), 
                move: data.move 
            };
            BES.emit(`board/${id}`, JSON.stringify(payload));
        });

        OGS.on("game/" + id + "/clock", (data) => {
            const clockEmitID = `clock/${id}`;
            const payload = {
                type: clockEmitID,
                data: data,
            };
            BES.emit(clockEmitID, JSON.stringify(payload));
        });

        OGS.on("game/" + id + "/phase", (data) => {
            if (data === "finished") {
                OGS.send(["game/disconnect", { game_id: id }]);
                BES.emit("game/" + id + "/finished", { finished: "finished" });
            }
        });

        GAMES[id].listenersSet = true;
    }

    setupReviewListeners(id) {
        if (GAMES[id] && GAMES[id].listenersSet) return;

        OGS.on("review/" + id + "/r", (data) => {
            if (!data.m) {
                return;
            }
            
            // Handle review move updates - convert string to moves array
            let MOVES = [];
            if (data.m && data.m !== "") {
                MOVES = this.formatReviewMoveData("move", data.m);
                // Update the game's live moves to match the review position
                GAMES[id].liveMoves = MOVES;
                GAMES[id].moves = MOVES;
            } else {
                // Empty position
                MOVES = [];
                GAMES[id].liveMoves = [];
                GAMES[id].moves = [];
            }
            
            const UUID = GAMES[id].uuid;
            const QUERIES = GAMES[id].queries;
            this.queue.process(GAMES[id], UUID, QUERIES, MOVES, this.ai, BES);
            GAMES[id].queries++;

            const revertCoordsToNumbers = (move) => {
                const lastTwoChars = move.slice(-2);
                let [x, y] = lastTwoChars;

                const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s"];
                x = letters.indexOf(x);
                y = letters.indexOf(y);
                return [x, y];
            };

            const payload = { 
                board: GAMES[id].board.state(MOVES), 
                move: (data.m && data.m !== "") ? revertCoordsToNumbers(data.m) : []
            };
            BES.emit(`board/${id}`, JSON.stringify(payload));
        });

        GAMES[id].listenersSet = true;
    }

    stringMovesToCoordinates(moveString) {
        const letters = "abcdefghjklmnopqrst";

        if (typeof moveString !== "string") {
            console.error("Expected a string for moveString but received:", moveString);
            return [];
        }

        // Handle empty string case (0 moves)
        if (moveString === "" || moveString.trim() === "") {
            return [];
        }

        const coordinates = "abcdefghijklmnopqrs";
        const pairs = moveString.match(/.{1,2}/g);

        if (!pairs) {
            return [];
        }

        const moves = pairs
            .map((pair, i) => {
                if (pair[0] === "." && pair[1] === ".") {
                    return null;
                }
                
                const x_coord = coordinates.indexOf(pair[0]);
                const y_coord = coordinates.indexOf(pair[1]);
                
                // Convert to proper letter-number format for KataGo
                const x = letters[x_coord];
                const y = 19 - y_coord;
                const player = i % 2 === 0 ? "b" : "w";
                
                return [player, x, y];
            })
            .filter((move) => move !== null);

        return moves;
    }

    formatGameMoveData(submission, moves, currentColor = "b") {
        const letters = "abcdefghjklmnopqrst";
        switch (submission) {
            case "initial": {
                const formatedMoves = [];
                moves.forEach((move, index) => {
                    const color = index % 2 === 0 ? "b" : "w";
                    const x = move[0] == -1 ? "pass" : letters[move[0]];
                    const y = move[1] == -1 ? "pass" : 19 - move[1];
                    formatedMoves.push([color, x, y]);
                });
                return formatedMoves;
            }

            case "move": {
                const color = currentColor;
                const x = moves[0] == -1 ? "pass" : letters[moves[0]];
                const y = moves[1] == -1 ? "pass" : 19 - moves[1];
                const formatedMoves = [color, x, y];
                return formatedMoves;
            }
        }
    }

    formatReviewMoveData(submission, moves) {
        switch (submission) {
            case "initial":
            case "move": {
                // Handle empty string moves (no moves on board)
                if (moves === "" || moves === null || moves === undefined) {
                    return [];
                }
                
                const formatedMoves = this.stringMovesToCoordinates(moves);
                return formatedMoves;
            }
        }
    }

    formatGameStateData(type, data) {
        switch (type) {
            case "game": {
                const id = data.game_id;
                const name = data.game_name;
                const moves = data.moves;
                const BP = data.players.black.username;
                const BR = parseInt(data.players.black.rank);
                const WP = data.players.white.username;
                const WR = parseInt(data.players.white.rank);
                const formatedMoves = this.formatGameMoveData("initial", moves);

                const gamedata = {
                    id: id,
                    type: type,
                    name: name,
                    moves: formatedMoves,
                    players: {
                        black: {
                            name: BP,
                            rank: BR,
                        },
                        white: {
                            name: WP,
                            rank: WR,
                        },
                    },
                    current: formatedMoves.length % 2 == 0 ? "b" : "w",
                    // Include additional game metadata
                    rules: data.rules || {},
                    time_control: data.time_control || {},
                    phase: data.phase || "play",
                    width: data.width || 19,
                    height: data.height || 19,
                    komi: data.komi || 7.5,
                    handicap: data.handicap || []
                };

                GAMES[id] = new GameEntity(gamedata);
                return formatedMoves;
            }

            case "review": {
                const filteredData = data.filter((entry) => !entry.chat);
                const id = filteredData[0].id;
                const gameData = filteredData[0].gamedata;
                const name = gameData.game_name;
                const moves = filteredData[filteredData.length - 1].m;
                const BP = gameData.players.black.name;
                const BR = parseInt(gameData.players.black.rank);
                const WP = gameData.players.white.name;
                const WR = parseInt(gameData.players.white.rank);
                
                // Handle empty moves (demo board with no moves)
                let formatedMoves = [];
                if (moves && moves !== "") {
                    formatedMoves = this.formatReviewMoveData("initial", moves);
                } else {
                    formatedMoves = [];
                }

                const gamedata = {
                    id: id,
                    type: type,
                    name: name,
                    moves: formatedMoves,
                    players: {
                        black: {
                            name: BP,
                            rank: BR,
                        },
                        white: {
                            name: WP,
                            rank: WR,
                        },
                    },
                    current: formatedMoves.length % 2 == 0 ? "b" : "w",
                    // Include additional game metadata
                    rules: gameData.rules || {},
                    time_control: gameData.time_control || {},
                    phase: "review",
                    width: gameData.width || 19,
                    height: gameData.height || 19,
                    komi: gameData.komi || 7.5,
                    handicap: gameData.handicap || []
                };

                GAMES[id] = new GameEntity(gamedata);
                return formatedMoves;
            }
        }
    }

    sendInitialGameMetadata(id, data) {
        // Send initial clock data if available
        if (data.clock) {
            const clockEmitID = `clock/${id}`;
            const payload = {
                type: clockEmitID,
                data: data.clock,
            };
            BES.emit(clockEmitID, JSON.stringify(payload));
        }

        // Send initial game info
        const gameInfoEmitID = `gameinfo/${id}`;
        const gameInfoPayload = {
            type: gameInfoEmitID,
            data: {
                game_id: data.game_id,
                game_name: data.game_name,
                players: {
                    black: {
                        username: data.players.black.username,
                        rank: data.players.black.rank,
                        id: data.players.black.id
                    },
                    white: {
                        username: data.players.white.username,
                        rank: data.players.white.rank,
                        id: data.players.white.id
                    }
                },
                rules: data.rules || {},
                time_control: data.time_control || {},
                phase: data.phase,
                width: data.width,
                height: data.height,
                komi: data.komi,
                handicap: data.handicap
            }
        };
        BES.emit(gameInfoEmitID, JSON.stringify(gameInfoPayload));
    }

    sendInitialReviewMetadata(id, data) {
        const filteredData = data.filter((entry) => !entry.chat);
        const gameData = filteredData[0].gamedata;
        
        // Send initial game info for review
        const gameInfoEmitID = `gameinfo/${id}`;
        const gameInfoPayload = {
            type: gameInfoEmitID,
            data: {
                game_id: id,
                game_name: gameData.game_name,
                players: {
                    black: {
                        username: gameData.players.black.name,
                        rank: gameData.players.black.rank,
                        id: gameData.players.black.id
                    },
                    white: {
                        username: gameData.players.white.name,
                        rank: gameData.players.white.rank,
                        id: gameData.players.white.id
                    }
                },
                rules: gameData.rules || {},
                time_control: gameData.time_control || {},
                phase: "review",
                width: gameData.width,
                height: gameData.height,
                komi: gameData.komi,
                handicap: gameData.handicap
            }
        };
        BES.emit(gameInfoEmitID, JSON.stringify(gameInfoPayload));

        // Send review-specific data
        const reviewDataEmitID = `reviewdata/${id}`;
        const reviewDataPayload = {
            type: reviewDataEmitID,
            data: {
                review_id: id,
                moves_string: filteredData[filteredData.length - 1].m || "",
                total_moves: filteredData.length - 1,
                review_data: filteredData
            }
        };
        BES.emit(reviewDataEmitID, JSON.stringify(reviewDataPayload));
    }
}

module.exports = OGSConnection; 