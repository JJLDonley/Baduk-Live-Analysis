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

                if (GAMES[id]) {
                    const game = GAMES[id];
                    const gameEmitID = `${game.type}/${game.id}`;
                    game.state = game.board.state(game.moves);
                    game.last.move = game.moves[game.moves.length - 1];
                    game.lastMoveToArrayCoordinates();
                    
                    const payload = {
                        type: gameEmitID,
                        data: game.data(),
                    };
                    
                    BES.emit(gameEmitID, JSON.stringify(payload));
                    
                    const payload2 = { 
                        board: game.state, 
                        move: [game.last.move[1], game.last.move[2]] 
                    };
                    
                    BES.emit(`board/${id}`, JSON.stringify(payload2));
                } else {
                    this.connectLiveGame(type, id);
                }
            });

            socket.on("disconnect", () => {});
        });
    }

    connectLiveGame(type, id) {
        if (!GAMES[id]) {
            GAMES[id] = {};
        }

        switch (type) {
            case "game":
                this.connectGame(id);
                break;
            case "review":
                this.connectReview(id);
                break;
            default:
                return;
        }
    }

    connectGame(id) {
        OGS.emit("game/connect", {
            game_id: id,
            chat: false,
        });

        OGS.on("game/" + id + "/gamedata", (data) => {
            if (data.phase === "finished") {
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
                return;
            }

            const UUID = GAMES[id].uuid;
            const QUERIES = GAMES[id].queries;
            this.queue.process(GAMES[id], UUID, QUERIES, MOVES, this.ai, BES);
            GAMES[id].queries++;
            this.setupGameListeners(id);
            
            const payload = {
                board: GAMES[id].board.state(MOVES),
                move: data.moves[data.moves.length - 1],
            };
            BES.emit(`board/${id}`, JSON.stringify(payload));
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
            if (MOVES == undefined) {
                return;
            }

            const UUID = GAMES[id].uuid;
            const QUERIES = GAMES[id].queries;
            this.queue.process(GAMES[id], UUID, QUERIES, MOVES, this.ai, BES);
            GAMES[id].queries++;
            this.setupReviewListeners(id);

            const payload = { 
                board: GAMES[id].board.state(MOVES), 
                move: MOVES[MOVES.length - 1] 
            };
            BES.emit(`board/${id}`, JSON.stringify(payload));
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
            
            const MOVES = this.formatReviewMoveData("move", data.m);
            const UUID = GAMES[id].uuid;
            const QUERIES = GAMES[id].queries;
            this.queue.process(GAMES[id], UUID, QUERIES, MOVES, this.ai, BES);
            GAMES[id].queries++;

            console.log("Review Last Move, move data", MOVES[MOVES.length - 1]);
            
            const revertCoordsToNumbers = (move) => {
                console.log("Reverting coordinates to numbers", move);
                const lastTwoChars = move.slice(-2);
                let [x, y] = lastTwoChars;

                const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s"];
                x = letters.indexOf(x);
                y = letters.indexOf(y);
                console.log("Reverting coordinates to numbers", [x, y]);
                return [x, y];
            };

            const payload = { 
                board: GAMES[id].board.state(MOVES), 
                move: revertCoordsToNumbers(data.m) 
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
                const x_num = coordinates.indexOf(pair[0]);
                const y = 19 - coordinates.indexOf(pair[1]);
                const x = letters[x_num];
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
                    const x = moves[0] == -1 ? "pass" : letters[move[0]];
                    const y = moves[1] == -1 ? "pass" : 19 - move[1];
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
                };

                GAMES[id] = new GameEntity(gamedata);
                return formatedMoves;
            }

            case "review": {
                const filteredData = data.filter((entry) => !entry.chat);
                const id = filteredData[0].id;
                const name = filteredData[0].gamedata.game_name;
                const moves = filteredData[filteredData.length - 1].m;
                const BP = filteredData[0].gamedata.players.black.name;
                const BR = parseInt(filteredData[0].gamedata.players.black.rank);
                const WP = filteredData[0].gamedata.players.white.name;
                const WR = parseInt(filteredData[0].gamedata.players.white.rank);
                const formatedMoves = this.formatReviewMoveData("initial", moves);

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
                };

                GAMES[id] = new GameEntity(gamedata);
                return formatedMoves;
            }
        }
    }
}

module.exports = OGSConnection; 