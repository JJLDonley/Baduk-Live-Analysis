const { v4: uuidv4 } = require("uuid");
const GameAnalysis = require("./analysis.js");

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
        this.handicap = [];
        this.komi = 7.5;
        this.current = {
            player: data.current,
            move: 0,
        };
        this.last = {
            move: [],
            value: 0,
        };
        this.lead = "";
        
        this.initiatePlayerVariables(data.players);
        this.analysisEngine = new GameAnalysis(this);
    }

    initiatePlayerVariables(data) {
        this.player = {
            black: {
                name: data.black.name,
                rank: data.black.rank,
                winrate: 50
            },
            white: {
                name: data.white.name,
                rank: data.white.rank,
                winrate: 50
            }
        };
    }

    async analysis(query, moves) {
        this.moves = moves;
        await this.analysisEngine.processQuery(query, moves);
    }

    lastMoveToArrayCoordinates() {
        if (!this.last.move[0]) return;
        
        const move = this.last.move;
        const color = move[0];
        const letters = "abcdefghjklmnopqrst";

        const x = letters.indexOf(move[1]);
        const y = 19 - move[2];

        this.last.move = [color, x, y];
    }

    data() {
        const analysisData = this.analysisEngine.getAnalysisData();
        
        return {
            ...analysisData,
            current: {
                move: this.current.move,
                player: this.current.player,
            },
            id: this.id,
            last: {
                move: this.last.move,
                value: (this.last.value * 0.1).toFixed(2),
            },
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
            state: this.state,
            uuid: this.uuid,
        };
    }
}

class Board {
    constructor() {
        this.grid = Array.from({ length: 19 }, () => Array(19).fill(""));
        this.size = 19;
    }

    playMove(move) {
        if (typeof move[0] !== "string") return;
        if (typeof move[1] !== "string") return;
        if (typeof move[2] !== "number") return;
        
        const color = move[0];
        if (color === 'undefined') return;

        const oppositeColor = color === "b" ? "w" : "b";
        const letters = "abcdefghjklmnopqrst";

        const initialX = letters.indexOf(move[1]);
        const initialY = move[2] - 1;

        // Swap x and y and then mirror the new x across the board's center
        const y = initialX;
        const x = this.size - 1 - initialY;

        // Place the stone
        try {
            this.grid[x][y] = color;
        } catch (error) {
            console.error(`Error setting [${x}, ${y}] & move: ${move}: `, error);
        }

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
