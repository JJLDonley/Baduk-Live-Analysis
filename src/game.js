const { v4: uuidv4 } = require("uuid");

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
		this.handicap = []
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
		if(move[1] == -1) return;
		
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

module.exports = { GameEntity, Board };
