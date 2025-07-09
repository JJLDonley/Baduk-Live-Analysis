/**
 * Game Move Query Manager
 * Handles analysis request queuing, prioritization, and management
 */
class GameMoveQueryManager {
    constructor(aiManager) {
        this.aiManager = aiManager;
        this.requestQueue = [];
        this.activeRequests = new Map();
        this.requestHistory = new Map();
        this.maxQueueSize = 100;
        this.maxActiveRequests = 5;
        this.maxRequestsPerGame = 3;
        this.requestTimeout = 30000; // 30 seconds
        this.priorityWeights = {
            moveNumber: 0.3,
            gameType: 0.2,
            clientPriority: 0.3,
            timestamp: 0.2
        };
        
        // Start processing queue
        this.startQueueProcessor();
    }

    /**
     * Process analysis request from client
     * @param {Object} request - Analysis request
     * @param {Object} socket - Client socket
     */
    processAnalysisRequest(request, socket) {
        try {
            // Validate request
            if (!this.validateRequest(request)) {
                this.sendError(socket, request.requestId, 'Invalid request format');
                return;
            }

            // Check queue limits
            if (this.requestQueue.length >= this.maxQueueSize) {
                this.sendError(socket, request.requestId, 'Analysis queue is full');
                return;
            }

            // Check per-game limits
            if (this.getActiveRequestsForGame(request.gameId) >= this.maxRequestsPerGame) {
                this.sendError(socket, request.requestId, 'Too many active requests for this game');
                return;
            }

            // Check for duplicate requests
            if (this.isDuplicateRequest(request)) {
                this.sendError(socket, request.requestId, 'Duplicate request');
                return;
            }

            // Create enhanced request object
            const enhancedRequest = {
                ...request,
                socket,
                clientId: socket.clientId,
                priority: this.calculatePriority(request),
                queuedAt: Date.now(),
                status: 'queued',
                retryCount: 0,
                maxRetries: 2
            };

            // Add to queue
            this.requestQueue.push(enhancedRequest);
            this.sortQueueByPriority();

            // Store in history
            this.requestHistory.set(request.requestId, enhancedRequest);

            console.log(`[GameMoveQueryManager] Queued analysis request ${request.requestId} for game ${request.gameId}`);
            
            // Send acknowledgment
            socket.emit('analysisQueued', {
                requestId: request.requestId,
                queuePosition: this.getQueuePosition(request.requestId),
                estimatedWaitTime: this.estimateWaitTime()
            });

        } catch (error) {
            console.error('[GameMoveQueryManager] Error processing analysis request:', error);
            this.sendError(socket, request.requestId, 'Internal server error');
        }
    }

    /**
     * Cancel analysis request
     * @param {string} requestId - Request ID to cancel
     * @param {Object} socket - Client socket
     */
    cancelAnalysisRequest(requestId, socket) {
        console.log(`[GameMoveQueryManager] Canceling analysis request ${requestId}`);
        
        // Remove from queue
        this.requestQueue = this.requestQueue.filter(req => req.requestId !== requestId);
        
        // Cancel active request
        if (this.activeRequests.has(requestId)) {
            const activeRequest = this.activeRequests.get(requestId);
            this.aiManager.cancelRequest(requestId);
            this.activeRequests.delete(requestId);
            
            // Update status
            if (this.requestHistory.has(requestId)) {
                this.requestHistory.get(requestId).status = 'cancelled';
            }
        }
        
        // Send confirmation
        socket.emit('analysisCancelled', { requestId });
    }

    /**
     * Cancel all requests for a client
     * @param {Object} socket - Client socket
     */
    cancelClientRequests(socket) {
        const clientId = socket.clientId;
        console.log(`[GameMoveQueryManager] Canceling all requests for client ${clientId}`);
        
        // Cancel queued requests
        this.requestQueue = this.requestQueue.filter(req => {
            if (req.clientId === clientId) {
                this.requestHistory.get(req.requestId).status = 'cancelled';
                return false;
            }
            return true;
        });
        
        // Cancel active requests
        for (const [requestId, activeRequest] of this.activeRequests) {
            if (activeRequest.clientId === clientId) {
                this.aiManager.cancelRequest(requestId);
                this.activeRequests.delete(requestId);
                this.requestHistory.get(requestId).status = 'cancelled';
            }
        }
    }

    /**
     * Start queue processor
     */
    startQueueProcessor() {
        setInterval(() => {
            this.processQueue();
        }, 1000); // Process every second
    }

    /**
     * Process queue - move requests to active processing
     */
    processQueue() {
        try {
            // Clean up timed out requests
            this.cleanupTimedOutRequests();
            
            // Process queue while we have capacity
            while (this.requestQueue.length > 0 && 
                   this.activeRequests.size < this.maxActiveRequests) {
                
                const request = this.requestQueue.shift();
                
                // Check if client is still connected
                if (!request.socket || !request.socket.connected) {
                    console.log(`[GameMoveQueryManager] Client disconnected, skipping request ${request.requestId}`);
                    this.requestHistory.get(request.requestId).status = 'failed';
                    continue;
                }
                
                // Move to active processing
                this.processActiveRequest(request);
            }
        } catch (error) {
            console.error('[GameMoveQueryManager] Error in queue processor:', error);
        }
    }

    /**
     * Process active request
     * @param {Object} request - Request to process
     */
    async processActiveRequest(request) {
        try {
            console.log(`[GameMoveQueryManager] Processing request ${request.requestId}`);
            
            // Update status
            request.status = 'processing';
            request.processedAt = Date.now();
            this.activeRequests.set(request.requestId, request);
            
            // Send processing notification
            request.socket.emit('analysisStarted', {
                requestId: request.requestId,
                estimatedDuration: this.estimateProcessingTime(request)
            });
            
            // Submit to AI manager
            const analysisResult = await this.aiManager.processAnalysis(request);
            
            // Handle successful result
            this.handleAnalysisResult(request, analysisResult);
            
        } catch (error) {
            console.error(`[GameMoveQueryManager] Error processing request ${request.requestId}:`, error);
            this.handleAnalysisError(request, error);
        }
    }

    /**
     * Handle successful analysis result
     * @param {Object} request - Original request
     * @param {Object} result - Analysis result
     */
    handleAnalysisResult(request, result) {
        try {
            // Update request status
            request.status = 'completed';
            request.completedAt = Date.now();
            
            // Create response
            const response = {
                requestId: request.requestId,
                gameId: request.gameId,
                gameType: request.gameType,
                moveNumber: request.moveNumber,
                result: result,
                processingTime: request.completedAt - request.processedAt,
                timestamp: Date.now()
            };
            
            // Send to client
            request.socket.emit('analysisResult', response);
            
            // Clean up
            this.activeRequests.delete(request.requestId);
            
            console.log(`[GameMoveQueryManager] Completed analysis for request ${request.requestId}`);
            
        } catch (error) {
            console.error(`[GameMoveQueryManager] Error sending analysis result:`, error);
            this.handleAnalysisError(request, error);
        }
    }

    /**
     * Handle analysis error
     * @param {Object} request - Original request
     * @param {Error} error - Error object
     */
    handleAnalysisError(request, error) {
        try {
            // Check if we should retry
            if (request.retryCount < request.maxRetries) {
                request.retryCount++;
                request.status = 'queued';
                
                // Add back to queue with higher priority
                request.priority += 10;
                this.requestQueue.push(request);
                this.sortQueueByPriority();
                
                console.log(`[GameMoveQueryManager] Retrying request ${request.requestId} (attempt ${request.retryCount})`);
                return;
            }
            
            // Update status
            request.status = 'failed';
            request.failedAt = Date.now();
            request.error = error.message;
            
            // Send error to client
            request.socket.emit('analysisError', {
                requestId: request.requestId,
                message: error.message,
                retryable: false
            });
            
            // Clean up
            this.activeRequests.delete(request.requestId);
            
            console.error(`[GameMoveQueryManager] Failed analysis for request ${request.requestId}:`, error.message);
            
        } catch (err) {
            console.error('[GameMoveQueryManager] Error in error handler:', err);
        }
    }

    /**
     * Calculate request priority
     * @param {Object} request - Request to prioritize
     * @returns {number} Priority score
     */
    calculatePriority(request) {
        let priority = 0;
        
        // Game type priority (live games > reviews)
        priority += request.gameType === 'game' ? 20 : 10;
        
        // Move number priority (later moves more important)
        priority += Math.min(request.moveNumber || 0, 50) * 0.2;
        
        // Client priority (could be based on subscription level)
        priority += 10; // Default client priority
        
        // Time-based priority (older requests get slight boost)
        const age = Date.now() - request.timestamp;
        priority += Math.min(age / 1000, 30) * 0.1;
        
        return priority;
    }

    /**
     * Validate analysis request
     * @param {Object} request - Request to validate
     * @returns {boolean} Whether request is valid
     */
    validateRequest(request) {
        if (!request || typeof request !== 'object') {
            return false;
        }
        
        const required = ['requestId', 'gameId', 'moves', 'metadata'];
        for (const field of required) {
            if (!request.hasOwnProperty(field)) {
                return false;
            }
        }
        
        if (!Array.isArray(request.moves)) {
            return false;
        }
        
        if (!request.metadata || typeof request.metadata !== 'object') {
            return false;
        }
        
        return true;
    }

    /**
     * Check if request is duplicate
     * @param {Object} request - Request to check
     * @returns {boolean} Whether request is duplicate
     */
    isDuplicateRequest(request) {
        // Check active requests
        for (const activeRequest of this.activeRequests.values()) {
            if (activeRequest.gameId === request.gameId && 
                activeRequest.moveNumber === request.moveNumber &&
                activeRequest.clientId === request.clientId) {
                return true;
            }
        }
        
        // Check queued requests
        for (const queuedRequest of this.requestQueue) {
            if (queuedRequest.gameId === request.gameId && 
                queuedRequest.moveNumber === request.moveNumber &&
                queuedRequest.clientId === request.clientId) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Sort queue by priority
     */
    sortQueueByPriority() {
        this.requestQueue.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get queue position for request
     * @param {string} requestId - Request ID
     * @returns {number} Queue position
     */
    getQueuePosition(requestId) {
        return this.requestQueue.findIndex(req => req.requestId === requestId) + 1;
    }

    /**
     * Estimate wait time
     * @returns {number} Estimated wait time in milliseconds
     */
    estimateWaitTime() {
        const avgProcessingTime = 10000; // 10 seconds average
        const queueSize = this.requestQueue.length;
        const activeCount = this.activeRequests.size;
        
        return Math.max(0, (queueSize - activeCount) * avgProcessingTime / this.maxActiveRequests);
    }

    /**
     * Estimate processing time for request
     * @param {Object} request - Request to estimate
     * @returns {number} Estimated processing time in milliseconds
     */
    estimateProcessingTime(request) {
        const basetime = 8000; // 8 seconds base
        const moveComplexity = Math.min(request.moves.length, 100) * 50; // 50ms per move
        return basetime + moveComplexity;
    }

    /**
     * Get active requests for game
     * @param {string} gameId - Game ID
     * @returns {number} Number of active requests
     */
    getActiveRequestsForGame(gameId) {
        return Array.from(this.activeRequests.values())
            .filter(req => req.gameId === gameId).length;
    }

    /**
     * Clean up timed out requests
     */
    cleanupTimedOutRequests() {
        const now = Date.now();
        
        for (const [requestId, request] of this.activeRequests) {
            if (now - request.processedAt > this.requestTimeout) {
                console.warn(`[GameMoveQueryManager] Request ${requestId} timed out`);
                
                // Cancel AI request
                this.aiManager.cancelRequest(requestId);
                
                // Send timeout error
                if (request.socket && request.socket.connected) {
                    request.socket.emit('analysisError', {
                        requestId,
                        message: 'Analysis timed out',
                        retryable: true
                    });
                }
                
                // Update status
                request.status = 'timeout';
                this.activeRequests.delete(requestId);
            }
        }
    }

    /**
     * Send error to client
     * @param {Object} socket - Client socket
     * @param {string} requestId - Request ID
     * @param {string} message - Error message
     */
    sendError(socket, requestId, message) {
        socket.emit('analysisError', {
            requestId,
            message,
            retryable: false
        });
    }

    /**
     * Get queue statistics
     * @returns {Object} Queue statistics
     */
    getQueueStats() {
        return {
            queueSize: this.requestQueue.length,
            activeRequests: this.activeRequests.size,
            totalRequests: this.requestHistory.size,
            avgWaitTime: this.estimateWaitTime(),
            gameStats: this.getGameStats()
        };
    }

    /**
     * Get game statistics
     * @returns {Object} Game statistics
     */
    getGameStats() {
        const stats = {};
        
        // Count requests by game
        for (const request of this.requestHistory.values()) {
            if (!stats[request.gameId]) {
                stats[request.gameId] = {
                    total: 0,
                    completed: 0,
                    failed: 0,
                    active: 0
                };
            }
            
            stats[request.gameId].total++;
            stats[request.gameId][request.status]++;
        }
        
        return stats;
    }

    /**
     * Shutdown manager
     */
    shutdown() {
        console.log('[GameMoveQueryManager] Shutting down...');
        
        // Cancel all active requests
        for (const [requestId, request] of this.activeRequests) {
            this.aiManager.cancelRequest(requestId);
            
            if (request.socket && request.socket.connected) {
                request.socket.emit('analysisError', {
                    requestId,
                    message: 'Server shutting down',
                    retryable: false
                });
            }
        }
        
        // Clear data structures
        this.requestQueue = [];
        this.activeRequests.clear();
        this.requestHistory.clear();
    }
}

module.exports = GameMoveQueryManager; 