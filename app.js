const { v4: uuidv4 } = require("uuid");
const path = require("path");
const Queue = require("./src/queue.js");
const KataGo = require("./src/ai.js");
const { GameEntity, Board } = require("./src/game.js");
const {
	APP,
	AIEXE,
	AICONFIG,
	AIMODEL,
	BES,
	GAMES,
	HTTP_SERVER,
	OGS,
	PORT,
} = require("./src/constants.js");
const AI = new KataGo(AIEXE, AICONFIG, AIMODEL);
const QUEUE = new Queue();

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
		const x_num = coordinates.indexOf(pair[0]);
		const y = 19 - coordinates.indexOf(pair[1]); // subtract from 19 for correct row
		const x = letters[x_num];
		const player = i % 2 === 0 ? "b" : "w"; // assume 'b' goes first
		return [player, x, y];
	});

	return moves;
};

function formatGameMoveData(submission, moves, currentColor = "b") {
	const letters = "abcdefghjklmnopqrst";
	switch (submission) {
		case "initial": {
			const formattedMoves = [];
			moves.forEach((move, index) => {
				const color = index % 2 === 0 ? "b" : "w";
				const x = letters[move[0]];
				const y = 19 - move[1];
				formattedMoves.push([color, x, y]);
			});
			return formattedMoves;
		}

		case "move": {
			const color = currentColor;
			const x = letters[moves[0]];
			const y = 19 - moves[1];
			const formattedMoves = [color, x, y];
			return formattedMoves;
		}
	}
}

function formatReviewMoveData(submission, moves) {
	switch (submission) {
		case "initial": {
			const formattedMoves = stringMovesToCoordinates(moves);
			return formattedMoves;
		}
		case "move": {
			const formattedMoves = stringMovesToCoordinates(moves);
			return formattedMoves;
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
			const formattedMoves = formatGameMoveData("initial", moves);

			const gamedata = {
				id: id,
				type: type,
				name: name,
				moves: formattedMoves,
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
				current: formattedMoves.length > 0 ? formattedMoves[formattedMoves.length - 1][0] : null,
			};

			GAMES[id] = new GameEntity(gamedata);

			return formattedMoves;
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
			const formattedMoves = formatReviewMoveData("initial", moves);

			const gamedata = {
				id: id,
				type: type,
				name: name,
				moves: formattedMoves,
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
				current: formattedMoves.length > 0 ? formattedMoves[formattedMoves.length - 1][0] : null,
			};

			GAMES[id] = new GameEntity(gamedata);

			return formattedMoves;
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
			const currentColor = GAMES[id].current.move % 2 == 0 ? "b" : "w";
			const MOVE = formatGameMoveData("move", data.move, currentColor);
			let list = GAMES[id].moves;
			list.push(MOVE);
			const MOVES = list;
			const UUID = GAMES[id].uuid;
			const QUERIES = GAMES[id].queries;
			QUEUE.process(GAMES[id], UUID, QUERIES, MOVES, AI, BES);
			GAMES[id].queries++;
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
	socket.on("disconnect", () => {
		console.log("Frontend client disconnected");
	});
});

// OGS socket connection

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
	Object.keys(GAMES).forEach((game) => {
		OGS.off(`${game.type}/${game.id}`);
	});
});

OGS.on("error", (error) => {
	console.error("Socket connection error:", error);
});

// Start the server
HTTP_SERVER.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
