const { spawn } = require('child_process');
const readline = require('readline');

/**
 * AI Process Manager
 * Manages KataGo process with better isolation and error handling
 */
class AIProcess {
    constructor(executable, config, model) {
        this.executable = executable;
        this.config = config;
        this.model = model;
        this.process = null;
        this.readline = null;
        this.isRunning = false;
        this.pendingQueries = new Map();
        this.queryCount = 0;
        this.maxRetries = 3;
        this.restartDelay = 5000;
        this.processTimeout = 30000;
        
        this.startProcess();
    }

    startProcess() {
        try {
            console.log('[AIProcess] Starting KataGo process...');
            
            this.process = spawn(this.executable, [
                'analysis',
                '-config', this.config,
                '-model', this.model
            ]);

            this.setupProcessHandlers();
            this.isRunning = true;
            
            console.log('[AIProcess] KataGo process started successfully');
            
        } catch (error) {
            console.error('[AIProcess] Failed to start KataGo process:', error);
            this.handleProcessError(error);
        }
    }

    setupProcessHandlers() {
        // Setup readline for stdout
        this.readline = readline.createInterface({
            input: this.process.stdout,
            crlfDelay: Infinity
        });

        this.readline.on('line', this.handleResponse.bind(this));

        // Handle process errors
        this.process.on('error', this.handleProcessError.bind(this));
        this.process.on('exit', this.handleProcessExit.bind(this));

        // Handle stderr
        this.process.stderr.on('data', (data) => {
            const message = data.toString();
            if (message.includes('error') || message.includes('ERROR')) {
                console.error('[AIProcess] KataGo stderr:', message);
            }
        });
    }

    handleResponse(line) {
        try {
            const response = JSON.parse(line);
            const queryId = response.id;
            
            if (this.pendingQueries.has(queryId)) {
                const { resolve, timeout } = this.pendingQueries.get(queryId);
                clearTimeout(timeout);
                this.pendingQueries.delete(queryId);
                resolve(response);
            }
            
        } catch (error) {
            console.error('[AIProcess] Error parsing response:', error);
            console.error('[AIProcess] Raw response:', line);
        }
    }

    handleProcessError(error) {
        console.error('[AIProcess] Process error:', error);
        this.isRunning = false;
        this.rejectPendingQueries(error);
    }

    handleProcessExit(code, signal) {
        console.log(`[AIProcess] Process exited with code ${code}, signal ${signal}`);
        this.isRunning = false;
        this.rejectPendingQueries(new Error(`Process exited: ${code}`));
        
        // Auto-restart if not intentional shutdown
        if (code !== 0 && !this.shuttingDown) {
            console.log('[AIProcess] Auto-restarting process...');
            setTimeout(() => {
                this.startProcess();
            }, this.restartDelay);
        }
    }

    rejectPendingQueries(error) {
        for (const [queryId, { reject, timeout }] of this.pendingQueries) {
            clearTimeout(timeout);
            reject(error);
        }
        this.pendingQueries.clear();
    }

    async query(moves, options = {}) {
        if (!this.isRunning) {
            throw new Error('AI process not running');
        }

        const queryId = String(++this.queryCount);
        const query = {
            id: queryId,
            moves: moves || [],
            rules: options.rules || 'chinese',
            komi: options.komi || 7.5,
            boardXSize: options.boardXSize || 19,
            boardYSize: options.boardYSize || 19,
            includePolicy: options.includePolicy !== false,
            includeOwnership: options.includeOwnership !== false,
            maxVisits: options.maxVisits || 100
        };

        return new Promise((resolve, reject) => {
            // Set timeout
            const timeout = setTimeout(() => {
                this.pendingQueries.delete(queryId);
                reject(new Error('Query timeout'));
            }, this.processTimeout);

            // Store pending query
            this.pendingQueries.set(queryId, { resolve, reject, timeout });

            // Send query
            try {
                this.process.stdin.write(JSON.stringify(query) + '\n');
            } catch (error) {
                this.pendingQueries.delete(queryId);
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    cancelQuery(queryId) {
        if (this.pendingQueries.has(queryId)) {
            const { reject, timeout } = this.pendingQueries.get(queryId);
            clearTimeout(timeout);
            this.pendingQueries.delete(queryId);
            reject(new Error('Query cancelled'));
        }
    }

    getStats() {
        return {
            isRunning: this.isRunning,
            pendingQueries: this.pendingQueries.size,
            totalQueries: this.queryCount,
            processId: this.process ? this.process.pid : null
        };
    }

    shutdown() {
        console.log('[AIProcess] Shutting down...');
        this.shuttingDown = true;
        
        // Reject pending queries
        this.rejectPendingQueries(new Error('Shutting down'));
        
        // Close readline
        if (this.readline) {
            this.readline.close();
        }
        
        // Kill process
        if (this.process) {
            this.process.kill('SIGTERM');
            
            // Force kill if doesn't exit gracefully
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }, 5000);
        }
        
        this.isRunning = false;
    }
}

/**
 * AI Manager
 * Manages multiple AI processes and load balancing
 */
class AIManager {
    constructor(config) {
        this.config = config;
        this.processes = [];
        this.currentProcess = 0;
        this.requestHistory = new Map();
        this.maxHistorySize = 1000;
        
        this.initializeProcesses();
    }

    initializeProcesses() {
        const numProcesses = this.config.numProcesses || 1;
        
        for (let i = 0; i < numProcesses; i++) {
            const process = new AIProcess(
                this.config.executable,
                this.config.config,
                this.config.model
            );
            this.processes.push(process);
        }
        
        console.log(`[AIManager] Initialized ${numProcesses} AI processes`);
    }

    getNextProcess() {
        // Round-robin load balancing
        const process = this.processes[this.currentProcess];
        this.currentProcess = (this.currentProcess + 1) % this.processes.length;
        
        // Check if process is running
        if (!process.isRunning) {
            // Find a running process
            for (let i = 0; i < this.processes.length; i++) {
                if (this.processes[i].isRunning) {
                    this.currentProcess = i;
                    return this.processes[i];
                }
            }
            throw new Error('No AI processes available');
        }
        
        return process;
    }

    async processAnalysis(request) {
        const requestId = request.requestId;
        const startTime = Date.now();
        
        try {
            console.log(`[AIManager] Processing analysis request ${requestId}`);
            
            // Convert moves to KataGo format
            const katagoMoves = this.convertMovesToKataGo(request.moves);
            
            // Prepare query options
            const options = {
                rules: request.metadata.rules || 'chinese',
                komi: request.metadata.komi || 7.5,
                boardXSize: request.metadata.width || 19,
                boardYSize: request.metadata.height || 19,
                includePolicy: true,
                includeOwnership: true,
                maxVisits: this.determineMaxVisits(request)
            };
            
            // Get available process
            const process = this.getNextProcess();
            
            // Execute query
            const result = await process.query(katagoMoves, options);
            
            // Store in history
            this.addToHistory(requestId, {
                request,
                result,
                processingTime: Date.now() - startTime,
                processId: process.process.pid
            });
            
            console.log(`[AIManager] Completed analysis ${requestId} in ${Date.now() - startTime}ms`);
            
            return result;
            
        } catch (error) {
            console.error(`[AIManager] Error processing analysis ${requestId}:`, error);
            
            // Store error in history
            this.addToHistory(requestId, {
                request,
                error: error.message,
                processingTime: Date.now() - startTime
            });
            
            throw error;
        }
    }

    convertMovesToKataGo(moves) {
        return moves.map(move => {
            if (move.x === 'pass' || move.y === 'pass') {
                return [move.color, 'pass'];
            }
            
            // Convert coordinates
            const letters = 'ABCDEFGHJKLMNOPQRST';
            const x = letters[move.x] || letters[0];
            const y = Math.max(1, Math.min(19, 19 - move.y));
            
            return [move.color, `${x}${y}`];
        });
    }

    determineMaxVisits(request) {
        // Adjust visits based on game type and move number
        let baseVisits = 100;
        
        if (request.gameType === 'game') {
            baseVisits = 200; // More visits for live games
        }
        
        // Reduce visits for early moves
        if (request.moveNumber < 10) {
            baseVisits = Math.max(50, baseVisits * 0.5);
        }
        
        return baseVisits;
    }

    cancelRequest(requestId) {
        console.log(`[AIManager] Canceling request ${requestId}`);
        
        // Try to cancel from all processes
        for (const process of this.processes) {
            process.cancelQuery(requestId);
        }
        
        // Update history
        if (this.requestHistory.has(requestId)) {
            this.requestHistory.get(requestId).cancelled = true;
        }
    }

    addToHistory(requestId, entry) {
        this.requestHistory.set(requestId, {
            ...entry,
            timestamp: Date.now()
        });
        
        // Limit history size
        if (this.requestHistory.size > this.maxHistorySize) {
            const oldest = this.requestHistory.keys().next().value;
            this.requestHistory.delete(oldest);
        }
    }

    getStats() {
        const processStats = this.processes.map((process, index) => ({
            index,
            ...process.getStats()
        }));
        
        return {
            totalProcesses: this.processes.length,
            runningProcesses: this.processes.filter(p => p.isRunning).length,
            totalRequests: this.requestHistory.size,
            processes: processStats,
            averageProcessingTime: this.getAverageProcessingTime()
        };
    }

    getAverageProcessingTime() {
        const completedRequests = Array.from(this.requestHistory.values())
            .filter(entry => entry.processingTime && !entry.error);
        
        if (completedRequests.length === 0) return 0;
        
        const totalTime = completedRequests.reduce((sum, entry) => sum + entry.processingTime, 0);
        return totalTime / completedRequests.length;
    }

    getRequestHistory() {
        return Array.from(this.requestHistory.entries()).map(([id, entry]) => ({
            requestId: id,
            ...entry
        }));
    }

    shutdown() {
        console.log('[AIManager] Shutting down...');
        
        // Shutdown all processes
        for (const process of this.processes) {
            process.shutdown();
        }
        
        // Clear history
        this.requestHistory.clear();
    }
}

module.exports = { AIManager, AIProcess }; 