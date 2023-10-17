const { spawn } = require("child_process");

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

module.exports = KataGo;
