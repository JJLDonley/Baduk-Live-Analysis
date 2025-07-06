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
        this.handicap = data.handicap || [];
        this.komi = data.komi || 7.5;
        this.current = {
            player: data.current,
            move: 0,
        };
        this.last = {
            move: [],
            value: 0,
        };
        this.lead = "";
        
        // Analysis history storage
        this.analysisHistory = [];
        this.maxAnalysisHistory = 2;
        
        // Store additional game metadata
        this.gameMetadata = {
            rules: data.rules || {},
            timeControl: data.time_control || {},
            phase: data.phase || "play",
            width: data.width || 19,
            height: data.height || 19,
            komi: data.komi || 7.5,
            handicap: data.handicap || []
        };
        
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
        const analysisResult = await this.analysisEngine.processQuery(query, moves);
        
        // Store analysis in history
        this.addAnalysisToHistory(analysisResult);
        
        return analysisResult;
    }

    addAnalysisToHistory(analysisResult) {
        // Add to beginning of array
        this.analysisHistory.unshift(analysisResult);
        
        // Keep only the last two analyses
        if (this.analysisHistory.length > this.maxAnalysisHistory) {
            this.analysisHistory.pop();
        }
    }

    getAnalysisHistory() {
        return this.analysisHistory;
    }

    getCurrentAnalysis() {
        return this.analysisHistory[0] || null;
    }

    getPreviousAnalysis() {
        return this.analysisHistory[1] || null;
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
        const currentAnalysis = this.getCurrentAnalysis();
        const analysisData = currentAnalysis ? currentAnalysis.data : this.analysisEngine.getAnalysisData();
        
        return {
            ...analysisData,
            id: this.id,
            name: this.name,
            type: this.type,
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
            // Game metadata
            gameMetadata: {
                rules: this.gameMetadata.rules,
                timeControl: this.gameMetadata.timeControl,
                phase: this.gameMetadata.phase,
                width: this.gameMetadata.width,
                height: this.gameMetadata.height,
                komi: this.gameMetadata.komi,
                handicap: this.gameMetadata.handicap
            },
            // Analysis metadata
            analysis: currentAnalysis ? {
                id: currentAnalysis.id,
                type: currentAnalysis.type,
                gameId: currentAnalysis.gameId,
                moveNumber: currentAnalysis.moveNumber,
                timestamp: currentAnalysis.timestamp
            } : null
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
        if (moves && moves.length > 0) {
            moves.forEach((move) => this.playMove(move));
        }
        return this.grid;
    }
}

module.exports = { GameEntity, Board };
