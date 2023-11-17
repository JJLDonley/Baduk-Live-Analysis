const { spawn } = require("child_process");
const readline = require('readline');

class KataGo {
    constructor(AIEXE, AICONFIG, AIMODEL) {
        this.engine = spawn(AIEXE, ["analysis", "-config", AICONFIG, "-model", AIMODEL]);
        this.totalQueries = 1;
        this.stderrThread = null;
        this.startErrorThread();

        this.pendingQueries = [];
        this.rl = readline.createInterface({
            input: this.engine.stdout,
            crlfDelay: Infinity
        });

        this.rl.on('line', this.handleLine.bind(this));
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

    async query(uuid, queries, moves) {
        const gameQueryID = uuid + ": " + queries;
        const query = this.queryHash(moves);

        return new Promise((resolve, reject) => {
            this.pendingQueries.push({ resolve, reject });
            this.engine.stdin.write(JSON.stringify(query) + "\n");
        });
    }

    handleLine(line) {
        try {
            const response = JSON.parse(line);
            if (this.pendingQueries.length > 0) {
                const { resolve } = this.pendingQueries.shift();
                resolve(response);
            }
        } catch (error) {
            console.error("Error parsing JSON: ", error);
            if (this.pendingQueries.length > 0) {
                const { reject } = this.pendingQueries.shift();
                reject(error);
            }
        }
    }

    close() {
        this.engine.stdin.end();
        clearInterval(this.stderrThread);
        this.rl.close();
        console.log("Closing KataGo Engine");
    }
}

module.exports = KataGo;
