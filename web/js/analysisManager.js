/**
 * AnalysisManager handles asynchronous analysis results and prevents out-of-order color assignments
 */
class AnalysisManager {
    constructor() {
        this.analysisQueue = [];
        this.currentMoveNumber = 0;
        this.pendingAnalyses = new Map(); // moveNumber -> analysis data
        this.processedAnalyses = new Set(); // track processed analysis IDs
        this.maxQueueSize = 50; // prevent memory leaks
    }

    /**
     * Add analysis result to the queue
     * @param {Object} analysisData - The analysis data from backend
     */
    addAnalysis(analysisData) {
        // Prevent duplicate processing
        if (this.processedAnalyses.has(analysisData.analysisId)) {
            console.log(`Analysis ${analysisData.analysisId} already processed, skipping`);
            return;
        }

        // Handle initial game position (move 0)
        if (analysisData.moveNumber === 0) {
            console.log(`Processing initial game position analysis`);
            this.processAnalysis(analysisData);
            this.processedAnalyses.add(analysisData.analysisId);
            this.currentMoveNumber = 0;
            return;
        }

        // Handle review analysis - process immediately for reviews
        if (analysisData.gameType === 'review') {
            this.processAnalysis(analysisData);
            this.processedAnalyses.add(analysisData.analysisId);
            this.currentMoveNumber = analysisData.moveNumber;
            return;
        }

        // Initialize current move number if this is the first analysis
        if (this.currentMoveNumber === 0 && analysisData.moveNumber > 0) {
            this.currentMoveNumber = analysisData.moveNumber - 1;
            console.log(`Initialized current move number to ${this.currentMoveNumber}`);
        }

        // Store analysis by move number for live games
        this.pendingAnalyses.set(analysisData.moveNumber, analysisData);
        
        // Process any sequential analyses that can be processed
        this.processQueue();
    }

    /**
     * Process analyses in the correct order
     */
    processQueue() {
        let processedCount = 0;
        
        // Process analyses in order
        while (this.pendingAnalyses.has(this.currentMoveNumber + 1)) {
            const nextMoveNumber = this.currentMoveNumber + 1;
            const analysisData = this.pendingAnalyses.get(nextMoveNumber);
            
            // Process this analysis
            this.processAnalysis(analysisData);
            
            // Mark as processed
            this.processedAnalyses.add(analysisData.analysisId);
            this.pendingAnalyses.delete(nextMoveNumber);
            this.currentMoveNumber = nextMoveNumber;
            
            processedCount++;
            
            // Safety check to prevent infinite loops
            if (processedCount > 100) {
                console.error("AnalysisManager: Too many analyses processed in one batch");
                break;
            }
        }
        
        // Clean up old processed analyses to prevent memory leaks
        this.cleanupOldAnalyses();
    }

    /**
     * Process a single analysis in the correct order
     * @param {Object} analysisData - The analysis data to process
     */
    processAnalysis(analysisData) {
        // Import the necessary functions dynamically or use global functions
        if (typeof window !== 'undefined' && window.APP) {
            // Use the existing APP functions
            window.APP.handleAIEvaluation(analysisData.data);
        } else {
            console.error("AnalysisManager: APP not available for processing");
        }
    }

    /**
     * Clean up old analyses to prevent memory leaks
     */
    cleanupOldAnalyses() {
        // Keep only recent processed analyses
        if (this.processedAnalyses.size > this.maxQueueSize) {
            const analysisArray = Array.from(this.processedAnalyses);
            const toRemove = analysisArray.slice(0, analysisArray.length - this.maxQueueSize);
            toRemove.forEach(id => this.processedAnalyses.delete(id));
        }
        
        // Remove old pending analyses that are too far behind
        const cutoffMoveNumber = this.currentMoveNumber - 10;
        for (const [moveNumber, analysisData] of this.pendingAnalyses) {
            if (moveNumber < cutoffMoveNumber) {
                console.warn(`Removing stale analysis for move ${moveNumber}`);
                this.pendingAnalyses.delete(moveNumber);
            }
        }
    }

    /**
     * Reset the analysis manager (for new games)
     */
    reset() {
        this.analysisQueue = [];
        this.currentMoveNumber = 0;
        this.pendingAnalyses.clear();
        this.processedAnalyses.clear();
    }

    /**
     * Get current state for debugging
     */
    getState() {
        return {
            currentMoveNumber: this.currentMoveNumber,
            pendingCount: this.pendingAnalyses.size,
            processedCount: this.processedAnalyses.size,
            pendingMoves: Array.from(this.pendingAnalyses.keys()).sort((a, b) => a - b)
        };
    }
}

export { AnalysisManager }; 