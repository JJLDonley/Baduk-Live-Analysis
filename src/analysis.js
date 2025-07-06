const { v4: uuidv4 } = require("uuid");

class GameAnalysis {
    constructor(gameEntity) {
        this.game = gameEntity;
        this.initializeAnalysisData();
    }

    initializeAnalysisData() {
        this.ai = {
            confidence: {
                black: { values: [], points: 0 },
                white: { values: [], points: 0 }
            },
            score: 1.5,
            winrate: {
                previous: 49.0,
                current: 61.0,
                black: 49.0,
                white: 61.0
            },
            moves: [],
            blue: [],
            green: [],
            yellow: [],
            ownership: []
        };
    }

    async processQuery(query, moves) {
        // Use game's actual metadata instead of generating random values
        const analysisId = uuidv4();
        const gameType = this.game.type;
        const gameId = this.game.id;
        
        this.game.current.player = query["rootInfo"]["currentPlayer"] || 
            (moves.length % 2 === 0 ? 'B' : 'W');
        this.game.current.move = moves.length;
        
        // Get the correct move number after updating, ensure it's never undefined
        const moveNumber = Math.max(0, this.game.current.move);

        // Update last move info
        if (moves.length > 0) {
            this.game.last.move = moves[moves.length - 1];
            this.game.lastMoveToArrayCoordinates();
        } else {
            // Initial position - no moves yet
            this.game.last.move = [];
        }
        this.game.last.value = 0.0;

        // Process AI analysis
        this.processScoreAnalysis(query);
        this.processWinrateAnalysis(query);
        this.processOwnershipAnalysis(query);
        this.processMoveAnalysis(query);
        this.calculateHumanWinRate();

        // Update game state
        this.game.state = this.game.board.state(this.game.liveMoves);
        
        // Return analysis result with correct metadata
        return {
            id: analysisId,
            type: gameType,
            gameId: gameId,
            moveNumber: moveNumber,
            timestamp: Date.now(),
            data: this.getAnalysisData()
        };
    }

    processScoreAnalysis(query) {
        this.ai.score = query["rootInfo"]["scoreLead"];
        this.game.lead = this.determineLead();
    }

    processWinrateAnalysis(query) {
        this.ai.winrate.previous = this.ai.winrate.current;
        this.ai.winrate.current = Math.round(query["rootInfo"]["winrate"] * 100);
        this.game.last.value = this.calculateLastMoveValue();
        this.determineIndividualPercentages();
    }

    processOwnershipAnalysis(query) {
        this.ai.ownership = query["ownership"];
        this.ai.confidence = this.confidenceOwnershipMap();
    }

    processMoveAnalysis(query) {
        this.ai.moves = this.sortAIQueryMoves(query["moveInfos"]);

        if (this.ai.moves.length > 0) {
            const colors = ["blue", "yellow", "green"];
            
            for (let i = 0; i < 3; i++) {
                if (this.ai.moves[i]) {
                    if (this.ai.moves[i][0] === 'pass') {
                        continue;
                    }
                    this.ai[colors[i]] = this.aiMoveToArrayCoordinates(this.ai.moves[i], colors[i]);
                }
            }
        }
    }

    aiMoveToArrayCoordinates(aiMove, color) {
        const move = aiMove[0];
        const letters = "ABCDEFGHJKLMNOPQRST";

        const letterPart = move.match(/[a-z]+/i)[0];
        const numberPart = parseInt(move.match(/\d+/)[0]);

        const x = letters.indexOf(letterPart);
        const y = 19 - numberPart;

        return [color, x, y];
    }

    calculateLastMoveValue() {
        const previous = this.ai.winrate.previous;
        const current = this.ai.winrate.current;
        return current - previous;
    }

    determineIndividualPercentages() {
        const percentage = this.ai.winrate.current;
        if (this.game.current.player === "B") {
            this.ai.winrate.black = percentage;
            this.ai.winrate.white = 100 - percentage;
        } else {
            this.ai.winrate.white = percentage;
            this.ai.winrate.black = 100 - percentage;
        }
    }

    calculateHumanWinRate() {
        const e = 2.71828182845904523536;

        const k = (n_move) => 1.99 - 0.00557 * n_move;
        const w = (L) => 0.0375 + 0.000543 * L;
        const d = (L) => 0.00292 * Math.pow(e, 0.354 * L) + 0.025;
        const g = (n_move, L) => 0.0001 * Math.pow(e, w(L) * n_move) + d(L);

        const QuentinWinrateFunction = (x, n_move, L) => {
            const middleNumerator = g(n_move, L) * x;
            const middleDenominator = Math.pow(
                1 + Math.pow(Math.abs(g(n_move, L) * x), k(n_move)),
                1 / k(n_move),
            );
            return (0.5 * middleNumerator) / middleDenominator + 0.5;
        };

        const x = this.ai.score;
        const L = 7;
        const n_move = this.game.current.move;

        const humanWinRate = Math.round(QuentinWinrateFunction(x, n_move, L) * 100);

        if (this.game.current.player === "B") {
            this.game.player.black.winrate = humanWinRate;
            this.game.player.white.winrate = 100 - humanWinRate;
        } else {
            this.game.player.black.winrate = 100 - humanWinRate;
            this.game.player.white.winrate = humanWinRate;
        }
    }

    confidenceOwnershipMap() {
        const ownership = this.ai.ownership;
        const current = this.game.current.player;
        const values = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
        const move = this.game.current.move / 2;

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

        return {
            black: {
                values: blackValues,
                territory: current === "W" 
                    ? blackValues.reduce((total, currentValue) => total + currentValue, 0) - move + 0.5
                    : blackValues.reduce((total, currentValue) => total + currentValue, 0) - move,
                points: blackValues.reduce((total, currentValue) => total + currentValue, 0),
            },
            white: {
                values: whiteValues,
                territory: current === "W"
                    ? whiteValues.reduce((total, currentValue) => total + currentValue, 0) - move - 0.5
                    : whiteValues.reduce((total, currentValue) => total + currentValue, 0) - move,
                points: whiteValues.reduce((total, currentValue) => total + currentValue, 0),
            }
        };
    }

    determineLead() {
        const current = Math.sign(this.ai.score) > 0 
            ? this.game.current.player 
            : this.game.current.player === "W" ? "B" : "W";
        return `${current}: ${Math.round(Math.abs(this.ai.score))}`;
    }

    sortAIQueryMoves(aiMoves) {
        return aiMoves
            .sort((b, a) => b["order"] - a["order"])
            .map((move) => [move["move"], move["order"]]);
    }

    getAnalysisData() {
        return {
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
            score: this.ai.score,
            winrate: {
                ai: {
                    black: this.ai.winrate.black,
                    current: this.ai.winrate.current,
                    white: this.ai.winrate.white,
                },
                human: {
                    black: this.game.player.black.winrate,
                    white: this.game.player.white.winrate,
                },
            },
            ai: {
                colors: [this.ai.blue, this.ai.green, this.ai.yellow],
                moves: this.ai.moves,
            },
            lead: this.game.lead,
            current: {
                move: this.game.current.move,
                player: this.game.current.player,
            },
            last: {
                move: this.game.last.move,
                value: this.game.last.move.length > 0 ? (this.game.last.value * 0.1).toFixed(2) : "0.00",
            },
        };
    }
}

module.exports = GameAnalysis; 