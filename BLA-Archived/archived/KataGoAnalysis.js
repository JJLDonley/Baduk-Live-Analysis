const express = require("express");
const { Server } = require("socket.io");
const io = require("socket.io-client");
const http = require("http");
const { v4: uuidv4 } = require("uuid");
const { spawn } = require("child_process");

const PORT = 2468;
const URL = "https://online-go.com"; // OGS URL
const PARAMS = { transports: ["websocket"] }; // OGS PARAMS

const APP = express();
const HTTP_SERVER = http.createServer(APP);
const BES = new Server(HTTP_SERVER); // Using Server constructor backend server
const OGS = io(URL, PARAMS); // OGS connection using 'io'
const GAMES = {};

const isLinux = process.env.IS_LINUX;
const AIEXE = isLinux ? "./katago-linux/katago" : "./katago/katago.exe";
const AICONFIG = isLinux ? "./katago-linux/default_config.cfg" : "./katago/default_config.cfg";
const AIMODEL = isLinux ? "./katago-linux/default_model.bin.gz" : "./katago/default_model.bin.gz";

const AI = new KataGo(AIEXE, AICONFIG, AIMODEL);
const QUEUE = new Queue();


class KataGo {
	constructor(AIEXE, AICONFIG, AIMODEL) {
		this.engine = spawn(AIEXE, ["analysis", "-config", AICONFIG, "-model", AIMODEL]);

		this.totalQueries = 1;
		this.stderrThread = null;
		this.startErrorThread();
	}

	startErrorThread() {
		this.stderrThread = setInterval(() => {
			const data = this.engine.stderr.read();
			if (data) {
				console.log("KataGo: ", data.toString());
			}
		}, 100);
	}

	moveToString(move) {
		const Letters = "ABCDEFGHJKLMNOPQRST";
		const Numbers = Array.from({ length: 19 }, (_, i) => 19 - i);

		const [x, y] = move;
		const col = Letters[x] || "";
		const row = Numbers[y] || "";
		return col + row;
	}

	queryHash(moves, maxVisits = null) {
		let query = {
			id: String(this.totalQueries),
			moves: moves.map(([color, x, y]) => [color, `${x}${y}`]),
			rules: "chinese",
			komi: 7.5,
			boardXSize: 19,
			boardYSize: 19,
			includePolicy: true,
			kata_analysis: true,
			includeOwnership: true,
		};

		if (maxVisits !== null) {
			query.maxVisits = maxVisits;
		}

		this.totalQueries++;

		return query;
	}

	async query(uuid, queries, moves, maxRetries = 3) {
		const listOfMoves = moves;
		const gameQueryID = uuid + ": " + queries;
		const query = this.queryHash(listOfMoves);

		this.engine.stdin.write(JSON.stringify(query) + "\n");

		return new Promise((resolve, reject) => {
			const tryParse = (data, retries = 0) => {
				try {
					const buffer = data;
					const jsonString = buffer.toString();
					const response = JSON.parse(jsonString);
					resolve(response);
				} catch (error) {
					if (retries < maxRetries) {
						console.warn(
							"query: ",
							gameQueryID,
							`Error parsing JSON. Retrying... (${retries + 1}/${maxRetries})`,
						);
						tryParse(data, retries + 1); // Recursive call
					} else {
						console.error("query: ", gameQueryID, " Error parsing JSON. Max retries reached.");
						reject("failed to parse"); // Reject the promise if max retries reached
					}
				}
			};

			this.engine.stdout.once("data", (data) => {
				tryParse(data);
			});

			this.engine.once("error", (error) => {
				reject(error);
			});
		}).catch((error) => {
			console.error("query: ", gameQueryID, "Error occurred while querying:");
			throw error; // Re-throw the error to propagate it to the caller
		});
	}

	close() {
		this.engine.stdin.end();
		clearInterval(this.stderrThread);
		console.log("Closing KataGo Engine");
	}
}

class GameEntity {
	constructor(data) {
		this.id = data.id;
		this.type = data.type;
		this.name = data.name;
		this.moves = data.moves;
		this.liveMoves = data.moves;
		this.queries = 0;
		this.uuid = uuidv4();
		this.state = [];
		this.board = new Board();
		this.komi = 7.5;
		this.current = {
			player: data.current,
			move: 0,
		};
		this.last = {
			move: [],
			value: 0,
		};
		this.initiatePlayerVariables(data.players);
		this.initiateAIVariables();
	}

	initiateAIVariables() {
		this.ai = {};
		this.ai.confidence = {};
		this.ai.confidence.black = {
			values: [],
			points: 0,
		};
		this.ai.confidence.white = {
			values: [],
			points: 0,
		};
		this.ai.score = 0;

		this.ai.winrate = {};
		this.ai.winrate.previous = 49.0;
		this.ai.winrate.current = 61.0;
		this.ai.winrate.black = 49.0;
		this.ai.winrate.white = 61.0;

		this.ai.moves = [];
		this.ai.blue = [];
		this.ai.green = [];
		this.ai.yellow = [];
		this.ai.ownership = [];
	}

	initiatePlayerVariables(data) {
		this.player = {};
		this.player.black = {};
		this.player.black.name = data.black.name;
		this.player.black.rank = data.black.rank;
		this.player.black.winrate = 50;

		this.player.white = {};
		this.player.white.name = data.white.name;
		this.player.white.rank = data.white.rank;
		this.player.white.winrate = 50;
	}

	async analysis(query, moves) {
		console.log(`Starting Analysis for ${this.name}: ${this.queries}`);

		this.moves = moves;
		this.current.player = query["rootInfo"]["currentPlayer"];
		this.current.move = this.moves.length;

		this.last.move = this.moves[this.moves.length - 1];
		this.lastMoveToArrayCoordinates();
		this.last.value = 0.0;

		// score
		this.ai.score = query["rootInfo"]["scoreLead"];
		this.lead = this.determineLead();

		// ai winrate
		this.ai.winrate.previous = this.ai.winrate.current;
		this.ai.winrate.current = Math.round(query["rootInfo"]["winrate"] * 100);
		this.last.value = this.calculateLastMoveValue();

		this.determineIndividualPercentages();
		this.calculateHumanWinRate();

		//ai point distrubition
		this.ai.ownership = query["ownership"];
		this.ai.confidence = this.confidenceOwnershipMap();
		// ai suggested moves

		this.ai.moves = this.sortAIQueryMoves(query["moveInfos"]);

    if (this.ai.moves.length > 0) {
        const colors = ["blue", "yellow", "green"];
        
        for (let i = 0; i < 3; i++) {
            if (this.ai.moves[i]) {
				if(this.ai.moves[i][0] === 'pass'){
					continue
				}
				
                this.ai[colors[i]] = this.aiMoveToArrayCoordinates(this.ai.moves[i], colors[i]);
            }
        }
    }
    

		this.state = this.board.state(this.moves);
	}

	aiMoveToArrayCoordinates(aiMove, color) {
		const move = aiMove[0];
		const letters = "ABCDEFGHJKLMNOPQRST";

		// Splitting the move into letter and number parts
		const letterPart = move.match(/[a-z]+/i)[0];
		const numberPart = parseInt(move.match(/\d+/)[0]);

		const x = letters.indexOf(letterPart);
		const y = 19 - numberPart; // Adjust for array's 0-based indexing

		return [color, x, y];
	}

	lastMoveToArrayCoordinates() {
		if(!this.last.move[0]) return;
		const move = this.last.move;
		const color = move[0];
		const letters = "abcdefghjklmnopqrst";

		// Get the x and y:
		const x = letters.indexOf(move[1]);
		const y = 19 - move[2]; // Adjust for array's 0-based indexing

		this.last.move = [color, x, y];
	}

	calculateHumanWinRate() {
		// euler constant
		const e = 2.71828182845904523536;

		function k(n_move) {
			return 1.99 - 0.00557 * n_move;
		}

		function w(L) {
			return 0.0375 + 0.000543 * L;
		}

		function d(L) {
			return 0.00292 * Math.pow(e, 0.354 * L) + 0.025;
		}

		function g(n_move, L) {
			return 0.0001 * Math.pow(e, w(L) * n_move) + d(L);
		}

		function QuentinWinrateFunction(x, n_move, L) {
			const middleNumerator = g(n_move, L) * x;
			const middleDenominator = Math.pow(
				1 + Math.pow(Math.abs(g(n_move, L) * x), k(n_move)),
				1 / k(n_move),
			);
			return (0.5 * middleNumerator) / middleDenominator + 0.5;
		}

		const x = this.ai.score; // score difference
		const L = 7; // player level
		const n_move = this.current.move; // move number

		let humanWinRate = Math.round(QuentinWinrateFunction(x, n_move, L) * 100);
		const current = this.current.player;
		let blackWinRate;
		let whiteWinRate;

		if (this.current.player === "B") {
			blackWinRate = humanWinRate;
			whiteWinRate = 100 - humanWinRate;
		} else {
			blackWinRate = 100 - humanWinRate;
			whiteWinRate = humanWinRate;
		}

		this.player.black.winrate = blackWinRate;
		this.player.white.winrate = whiteWinRate;
	}

	confidenceOwnershipMap() {
		const ownership = this.ai.ownership; // ai ownershipmap that is returned from the query
		const current = this.current.player; // decides who the positive point belongs
		const values = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
		const move = this.current.move / 2;

		let confidence = {};
		let blackValues = Array(10).fill(0);
		let whiteValues = Array(10).fill(0);

		for (let c = 0; c < ownership.length; c++) {
			const point = ownership[c];
			const pointAbs = Math.abs(point);
			const isPositive = Math.sign(point) > 0;

			for (let v = 0; v < values.length; v++) {
				if (pointAbs >= values[v]) {
					if (isPositive && current === "B") {
						blackValues[v] += pointAbs;
					} else if (isPositive && current === "W") {
						whiteValues[v] += pointAbs;
					} else if (!isPositive && current === "B") {
						whiteValues[v] += pointAbs;
					} else if (!isPositive && current === "W") {
						blackValues[v] += pointAbs;
					}
					break;
				}
			}
		}

		blackValues = blackValues.map((value) => Math.round(value));
		whiteValues = whiteValues.map((value) => Math.round(value));
		whiteValues[0] += 7;

		blackValues = [
			blackValues[0] + blackValues[1] + blackValues[2],
			blackValues[3] + blackValues[4] + blackValues[5],
			blackValues[6] + blackValues[7],
			blackValues[8] + blackValues[9],
		];
		whiteValues = [
			whiteValues[0] + whiteValues[1] + whiteValues[2],
			whiteValues[3] + whiteValues[4] + whiteValues[5],
			whiteValues[6] + whiteValues[7],
			whiteValues[8] + whiteValues[9],
		];

		confidence.black = {
			values: blackValues,
			territory:
				current == "W"
					? blackValues.reduce((total, currentValue) => total + currentValue, 0) - move + 0.5
					: blackValues.reduce((total, currentValue) => total + currentValue, 0) - move,
			points: blackValues.reduce((total, currentValue) => total + currentValue, 0),
		};
		confidence.white = {
			values: whiteValues,
			territory:
				current == "W"
					? whiteValues.reduce((total, currentValue) => total + currentValue, 0) - move - 0.5
					: whiteValues.reduce((total, currentValue) => total + currentValue, 0) - move,
			points: whiteValues.reduce((total, currentValue) => total + currentValue, 0),
		};

		return confidence;
	}

	determineLead() {
		const current =
			Math.sign(this.ai.score) > 0 ? this.current.player : this.current.player === "W" ? "B" : "W";
		return `${current}: ${Math.round(Math.abs(this.ai.score))}`;
	}

	calculateLastMoveValue() {
		const previous = this.ai.winrate.previous;
		const current = this.ai.winrate.current;
		const lastMoveValue = current - previous;
		return lastMoveValue;
	}

	determineIndividualPercentages() {
		const percentage = this.ai.winrate.current;
		if (this.current.player === "B") {
			this.ai.winrate.black = percentage;
			this.ai.winrate.white = 100 - percentage;
		} else {
			this.ai.winrate.white = percentage;
			this.ai.winrate.black = 100 - percentage;
		}
	}

	sortAIQueryMoves(aiMoves) {
		return aiMoves
			.sort((b, a) => b["order"] - a["order"])
			.map((move) => [move["move"], move["order"]]);
	}

	data() {
		const data = {
			confidence: {
				black: {
					points: this.ai.confidence.black.points,
					values: this.ai.confidence.black.values,
					territory: this.ai.confidence.black.territory,
				},
				white: {
					points: this.ai.confidence.white.points,
					values: this.ai.confidence.white.values,
					territory: this.ai.confidence.white.territory,
				},
			},
			current: {
				move: this.current.move,
				player: this.current.player,
			},
			id: this.id,
			last: {
				move: this.last.move,
				value: (this.last.value * 0.1).toFixed(2),
			},
			lead: this.lead,
			moves: this.moves,
			players: {
				black: {
					name: this.player.black.name,
					rank: this.player.black.rank,
					winrate: this.player.black.winrate,
				},
				white: {
					name: this.player.white.name,
					rank: this.player.white.rank,
					winrate: this.player.white.winrate,
				},
			},
			score: this.ai.score,
			state: this.state,
			uuid: this.uuid,
			winrate: {
				ai: {
					black: this.ai.winrate.black,
					current: this.ai.winrate.current,
					white: this.ai.winrate.white,
				},
				human: {
					black: this.player.black.winrate,
					white: this.player.white.winrate,
				},
			},
			ai: {
				colors: [this.ai.blue, this.ai.green, this.ai.yellow],
				moves: this.ai.moves,
			},
		};

		return data;
	}
}

class Board {
	constructor() {
		this.grid = Array.from({ length: 19 }, () => Array(19).fill(""));
		this.size = 19;
	}

	playMove(move) {
		const color = move[0];
		const oppositeColor = color === "b" ? "w" : "b";

		const letters = "abcdefghjklmnopqrst";

		// Initially, get the x and y as you do:
		const initialX = letters.indexOf(move[1]);
		const initialY = move[2] - 1;

		// Swap x and y and then mirror the new x across the board's center:
		const y = initialX;
		const x = this.size - 1 - initialY;

		// Place the stone
		this.grid[x][y] = color;

		// Find groups and remove them if their liberties are zero, only for the opposite color
		const groups = this.findGroups();
		groups.forEach(({ color: groupColor, group }) => {
			if (groupColor === oppositeColor && this.calculateLiberties(group) === 0) {
				group.forEach(([gx, gy]) => (this.grid[gx][gy] = ""));
			}
		});
	}

	findGroups() {
		const groups = [];
		const visited = Array(this.size)
			.fill(false)
			.map(() => Array(this.size).fill(false));
		const directions = [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		];

		for (let x = 0; x < this.size; x++) {
			for (let y = 0; y < this.size; y++) {
				const color = this.grid[x][y];
				if (color && !visited[x][y]) {
					const group = [];
					const stack = [[x, y]];
					while (stack.length > 0) {
						const [cx, cy] = stack.pop();
						if (visited[cx][cy]) continue;
						visited[cx][cy] = true;
						group.push([cx, cy]);
						for (const [dx, dy] of directions) {
							const adjX = cx + dx;
							const adjY = cy + dy;
							if (adjX < 0 || adjX >= this.size || adjY < 0 || adjY >= this.size) continue;
							if (this.grid[adjX][adjY] === color && !visited[adjX][adjY]) {
								stack.push([adjX, adjY]);
							}
						}
					}
					groups.push({ color, group });
				}
			}
		}
		return groups;
	}

	calculateLiberties(group) {
		const liberties = new Set();
		const directions = [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		];

		for (const [x, y] of group) {
			for (const [dx, dy] of directions) {
				const adjX = x + dx;
				const adjY = y + dy;
				if (adjX < 0 || adjX >= this.size || adjY < 0 || adjY >= this.size) continue;
				if (this.grid[adjX][adjY] === "") {
					liberties.add([adjX, adjY].toString());
				}
			}
		}

		return liberties.size;
	}

	state(moves) {
		this.grid = Array.from({ length: 19 }, () => Array(19).fill(""));
		if (moves.length > 0) {
			moves.forEach((move) => this.playMove(move));
		}

		return this.grid;
	}
}

class Queue {
	constructor() {
		this.queue = [];
		this.processing = false;
	}

	async process(game, uuid, queries, moves, ai, BES) {
		this.queue.push({ game, uuid, queries, moves, ai, BES });
		if (!this.processing) this.processNext();
	}

	async processNext() {
		if (this.queue.length === 0) {
			this.processing = false;
			return;
		}

		this.processing = true;

		const { game, uuid, queries, moves, ai, BES } = this.latestUniqueMove();

		try {
			const query = await ai.query(uuid, queries, moves);
			await game.analysis(query, moves);

			const gameEmitID = `${game.type}/${game.id}`;

			const payload = {
				type: gameEmitID,
				data: game.data(),
			};
			console.log("Emitted: " + game.data());
			BES.emit(gameEmitID, JSON.stringify(payload));
		} catch (error) {
			console.error("Error processing query:", error);
		}

		await this.processNext(); // Use 'await' here
	}

	latestUniqueMove() {
		if (this.queue.length === 0) {
			return null;
		}
	
		let latestMove = this.queue.shift();
		let i = 0;
	
		while (i < this.queue.length) {
			if (this.queue[i].uuid === latestMove.uuid) {
				latestMove = this.queue.splice(i, 1)[0];
			} else {
				i++;
			}
		}
	
		return latestMove;
	}
	
}


const stringMovesToCoordinates = (moveString) => {
	const letters = "abcdefghjklmnopqrst";

	if (typeof moveString !== "string") {
		console.error("Expected a string for moveString but received:", moveString);
		return [];
	}

	const coordinates = "abcdefghijklmnopqrs";
	const pairs = moveString.match(/.{1,2}/g); // split into pairs

	if (!pairs) {
		return [];
	}

	const moves = pairs.map((pair, i) => {
		if(pair[0] === "." && pair[1] === "."){
			return null;
		}
		const x_num = coordinates.indexOf(pair[0]);
		const y = 19 - coordinates.indexOf(pair[1]);
		const x = letters[x_num];
		const player = i % 2 === 0 ? "b" : "w";
		return [player, x, y];
	}).filter(move => move !== null);

	return moves;
};

function formatGameMoveData(submission, moves, currentColor = "b") {
	const letters = "abcdefghjklmnopqrst";
	switch (submission) {
		case "initial": {
			const formatedMoves = [];
			moves.forEach((move, index) => {
				const color = index % 2 === 0 ? "b" : "w";
				const x = letters[move[0]];
				const y = 19 - move[1];
				formatedMoves.push([color, x, y]);
			});
			return formatedMoves;
		}

		case "move": {
			const color = currentColor;
			const x = letters[moves[0]];
			const y = 19 - moves[1];
			const formatedMoves = [color, x, y];
			return formatedMoves;
		}
	}
}

function formatReviewMoveData(submission, moves) {
	switch (submission) {
		case "initial": {
			const formatedMoves = stringMovesToCoordinates(moves);
			return formatedMoves;
		}
		case "move": {
			const formatedMoves = stringMovesToCoordinates(moves);
			return formatedMoves;
		}
	}
}

// formate game data

function formatGameStateData(type, data) {
	switch (type) {
		case "game": {
			const id = data.game_id;
			const name = data.game_name;
			const moves = data.moves;
			const BP = data.players.black.username;
			const BR = parseInt(data.players.black.rank);
			const WP = data.players.white.username;
			const WR = parseInt(data.players.white.rank);
			const formatedMoves = formatGameMoveData("initial", moves);

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
				current: formatedMoves.length % 2 == 0 ? 'b':'w' ,
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
			const formatedMoves = formatReviewMoveData("initial", moves);

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

// OGS listeners

function setupOGSListeners(type, id) {
	if (GAMES[id] && GAMES[id].listenersSet) return;

	if (type === "game") {
		OGS.on("game/" + id + "/move", (data) => {
			if (!data.move) {
				return;
			}
			let list = GAMES[id].liveMoves;
			const currentColor = list.length % 2 == 0 ? "b" : "w";
			const MOVE = formatGameMoveData("move", data.move, currentColor);
			list.push(MOVE);
			const MOVES = list;
			const UUID = GAMES[id].uuid;
			const QUERIES = GAMES[id].queries;
			GAMES[id].liveMoves = list;
			QUEUE.process(GAMES[id], UUID, QUERIES, MOVES, AI, BES);
			GAMES[id].queries++;
		});

		OGS.on("game/" + id + "/clock", (data) => {
			const clockEmitID = `clock/${id}`;

			const payload = {
				type: clockEmitID,
				data: data,
			};
			BES.emit(clockEmitID, JSON.stringify(payload));
		});
	} else if (type === "review") {
		OGS.on("review/" + id + "/r", (data) => {
			if (!data.m) {
				return;
			}
			const MOVES = formatReviewMoveData("move", data.m);
			const UUID = GAMES[id].uuid;
			const QUERIES = GAMES[id].queries;
			QUEUE.process(GAMES[id], UUID, QUERIES, MOVES, AI, BES);
			GAMES[id].queries++;
		});
	}

	if (!GAMES[id]) GAMES[id] = {};
	GAMES[id].listenersSet = true;
}
// OGS game connection
function connectLiveGame(type, id) {
	// Emit the required signals for connection
	switch (type) {
		case "game":
			OGS.emit("game/connect", {
				game_id: id,
				chat: false,
			});

			OGS.on("game/" + id + "/gamedata", (data) => {
				const MOVES = formatGameStateData(type, data);
				if (MOVES == undefined) {
					console.log(`Game: ${GAMES[id].id} doesn't have moves yet`);
					return;
				}
				const UUID = GAMES[id].uuid;
				const QUERIES = GAMES[id].queries;
				QUEUE.process(GAMES[id], UUID, QUERIES, MOVES, AI, BES);
				GAMES[id].queries++;
				setupOGSListeners(type, id);
			});
			break;
		case "review":
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

				const MOVES = formatGameStateData(type, data);
				if (MOVES == undefined) {
					console.log(`Game: ${GAMES[id].id} doesn't have moves yet`);
					return;
				}
				const UUID = GAMES[id].uuid;
				const QUERIES = GAMES[id].queries;
				QUEUE.process(GAMES[id], UUID, QUERIES, MOVES, AI, BES);
				GAMES[id].queries++;
				setupOGSListeners(type, id);
			});
			break;
		default:
			return;
	}
}

// Express route
APP.get("/:type/:id", (req, res) => {
	let type = req.params.type;
	const id = req.params.id;

	// Validate the type
	if (!["game", "demo", "review"].includes(type)) {
		return res.status(400).send("Error: Not a proper type.");
	}

	// If type is 'demo', change it to 'review'
	if (type === "demo") type = "review";

	if (!GAMES[id]) {
		connectLiveGame(type, id);
	}

	res.sendFile(path.join(__dirname, "game.html"));
});

APP.get("/", (req, res) => {});

BES.on("connection", (socket) => {
	console.log("Frontend client connected");

	socket.on("subscribe", (game_id) => {
		const id = game_id["id"]; // Extract id directly from game_id

		if (GAMES[id]) {
			const game = GAMES[id];
			const gameEmitID = `${game.type}/${game.id}`;
			game.state = game.board.state(game.moves)
			game.last.move = game.moves[game.moves.length - 1];
			game.lastMoveToArrayCoordinates();
			const payload = {
				type: gameEmitID,
				data: game.data(),
			};
			console.log("Emitted: " + game.data());
			BES.emit(gameEmitID, JSON.stringify(payload));
		}
	});

	socket.on("disconnect", () => {
		console.log("Frontend client disconnected");
	});
});

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

		Object.keys(GAMES).forEach((game) => {
			connectLiveGame(game.type, game.id);
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

// Start the server
HTTP_SERVER.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
