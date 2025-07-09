/**
 * Analysis Result Analyzer
 * Processes KataGo analysis results and extracts meaningful data
 */
class AnalysisResultAnalyzer {
    constructor() {
        this.lastAnalysis = null;
        this.analysisHistory = [];
        this.maxHistorySize = 10;
    }

    /**
     * Process raw KataGo analysis result
     * @param {Object} rawAnalysis - Raw analysis data from KataGo
     * @param {Object} gameContext - Game context (moves, current player, etc.)
     * @returns {Object} Processed analysis data
     */
    processAnalysis(rawAnalysis, gameContext) {
        console.log('[AnalysisResultAnalyzer] Processing analysis:', rawAnalysis);
        
        const analysis = {
            id: this.generateAnalysisId(),
            timestamp: Date.now(),
            moveNumber: gameContext.moveNumber || 0,
            gameId: gameContext.gameId,
            gameType: gameContext.gameType,
            
            // Processed data
            winrate: this.extractWinrate(rawAnalysis, gameContext),
            confidence: this.extractConfidence(rawAnalysis),
            score: this.extractScore(rawAnalysis),
            ownership: this.extractOwnership(rawAnalysis),
            moves: this.extractMoves(rawAnalysis),
            lastMoveValue: this.calculateLastMoveValue(rawAnalysis),
            
            // Raw data for reference
            raw: rawAnalysis
        };
        
        // Store in history
        this.addToHistory(analysis);
        this.lastAnalysis = analysis;
        
        return analysis;
    }

    /**
     * Extract winrate information from KataGo analysis
     */
    extractWinrate(rawAnalysis, gameContext) {
        const rawWinrate = rawAnalysis.winrate || 0.5;
        const percentage = Math.round(rawWinrate * 100);
        
        // Determine current player
        const currentPlayer = gameContext.currentPlayer || 
            (gameContext.moveNumber % 2 === 0 ? 'b' : 'w');
        
        let blackWinrate, whiteWinrate;
        
        if (currentPlayer === 'b') {
            blackWinrate = percentage;
            whiteWinrate = 100 - percentage;
        } else {
            blackWinrate = 100 - percentage;
            whiteWinrate = percentage;
        }
        
        return {
            raw: rawWinrate,
            percentage: percentage,
            black: blackWinrate,
            white: whiteWinrate,
            currentPlayer: currentPlayer,
            previous: this.lastAnalysis ? this.lastAnalysis.winrate.percentage : 50
        };
    }

    /**
     * Extract confidence scores from ownership data
     */
    extractConfidence(rawAnalysis) {
        const ownership = rawAnalysis.ownership || [];
        if (ownership.length === 0) {
            return {
                black: { points: 0, values: Array(10).fill(0) },
                white: { points: 0, values: Array(10).fill(0) }
            };
        }
        
        const confidenceValues = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
        let blackValues = Array(10).fill(0);
        let whiteValues = Array(10).fill(0);
        
        for (const point of ownership) {
            const pointAbs = Math.abs(point);
            const isBlack = point > 0;
            
            for (let i = 0; i < confidenceValues.length; i++) {
                if (pointAbs >= confidenceValues[i]) {
                    if (isBlack) {
                        blackValues[i]++;
                    } else {
                        whiteValues[i]++;
                    }
                }
            }
        }
        
        return {
            black: {
                points: blackValues.reduce((sum, val) => sum + val, 0),
                values: blackValues
            },
            white: {
                points: whiteValues.reduce((sum, val) => sum + val, 0),
                values: whiteValues
            }
        };
    }

    /**
     * Extract score estimation
     */
    extractScore(rawAnalysis) {
        const scoreLead = rawAnalysis.scoreLead || 0;
        const scoreMean = rawAnalysis.scoreMean || scoreLead;
        const scoreStdev = rawAnalysis.scoreStdev || 0;
        
        return {
            lead: scoreLead,
            mean: scoreMean,
            stdev: scoreStdev,
            leader: scoreLead > 0 ? 'black' : 'white',
            leadAmount: Math.abs(scoreLead)
        };
    }

    /**
     * Extract ownership information
     */
    extractOwnership(rawAnalysis) {
        return rawAnalysis.ownership || [];
    }

    /**
     * Extract and rank move suggestions
     */
    extractMoves(rawAnalysis) {
        const moveInfos = rawAnalysis.moveInfos || [];
        
        // Sort by visits (most analyzed first)
        const sortedMoves = moveInfos
            .filter(move => move.move && move.move !== 'pass')
            .sort((a, b) => (b.visits || 0) - (a.visits || 0))
            .slice(0, 5) // Top 5 moves
            .map((move, index) => ({
                move: move.move,
                visits: move.visits || 0,
                winrate: move.winrate || 0.5,
                scoreLead: move.scoreLead || 0,
                rank: index + 1,
                color: this.getMoveColor(index),
                coordinates: this.moveToCoordinates(move.move)
            }));
        
        return sortedMoves;
    }

    /**
     * Calculate the value of the last move
     */
    calculateLastMoveValue(rawAnalysis) {
        if (!this.lastAnalysis) {
            return 0;
        }
        
        const currentWinrate = rawAnalysis.winrate || 0.5;
        const previousWinrate = this.lastAnalysis.raw.winrate || 0.5;
        
        return Math.round((currentWinrate - previousWinrate) * 100);
    }

    /**
     * Convert move string to board coordinates
     */
    moveToCoordinates(moveString) {
        if (!moveString || moveString === 'pass') {
            return null;
        }
        
        const letters = 'ABCDEFGHJKLMNOPQRST';
        const letterMatch = moveString.match(/[A-T]/);
        const numberMatch = moveString.match(/\d+/);
        
        if (!letterMatch || !numberMatch) {
            return null;
        }
        
        const x = letters.indexOf(letterMatch[0]);
        const y = 19 - parseInt(numberMatch[0]);
        
        return { x, y };
    }

    /**
     * Get color for move visualization
     */
    getMoveColor(index) {
        const colors = ['blue', 'yellow', 'green', 'orange', 'purple'];
        return colors[index] || 'gray';
    }

    /**
     * Calculate human-readable winrate using ELO-style formula
     */
    calculateHumanWinrate(score, moveNumber = 0) {
        const e = Math.E;
        const k = (n) => 1.99 - 0.00557 * n;
        const w = (L) => 0.0375 + 0.000543 * L;
        const d = (L) => 0.00292 * Math.pow(e, 0.354 * L) + 0.025;
        const g = (n, L) => 0.0001 * Math.pow(e, w(L) * n) + d(L);
        
        const L = 7; // Handicap constant
        const numerator = g(moveNumber, L) * score;
        const denominator = Math.pow(
            1 + Math.pow(Math.abs(g(moveNumber, L) * score), k(moveNumber)),
            1 / k(moveNumber)
        );
        
        return Math.round(((0.5 * numerator) / denominator + 0.5) * 100);
    }

    /**
     * Add analysis to history
     */
    addToHistory(analysis) {
        this.analysisHistory.unshift(analysis);
        if (this.analysisHistory.length > this.maxHistorySize) {
            this.analysisHistory.pop();
        }
    }

    /**
     * Get analysis history
     */
    getHistory() {
        return this.analysisHistory;
    }

    /**
     * Get last analysis
     */
    getLastAnalysis() {
        return this.lastAnalysis;
    }

    /**
     * Compare two analyses
     */
    compareAnalyses(current, previous) {
        if (!current || !previous) {
            return null;
        }
        
        return {
            winrateChange: current.winrate.percentage - previous.winrate.percentage,
            scoreChange: current.score.lead - previous.score.lead,
            confidenceChange: {
                black: current.confidence.black.points - previous.confidence.black.points,
                white: current.confidence.white.points - previous.confidence.white.points
            }
        };
    }

    /**
     * Generate unique analysis ID
     */
    generateAnalysisId() {
        return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Reset analyzer state
     */
    reset() {
        this.lastAnalysis = null;
        this.analysisHistory = [];
    }

    /**
     * Get analysis summary for display
     */
    getAnalysisSummary(analysis) {
        if (!analysis) return null;
        
        return {
            moveNumber: analysis.moveNumber,
            winrate: analysis.winrate,
            confidence: analysis.confidence,
            score: analysis.score,
            topMoves: analysis.moves.slice(0, 3),
            lastMoveValue: analysis.lastMoveValue,
            timestamp: analysis.timestamp
        };
    }
}

export { AnalysisResultAnalyzer }; 