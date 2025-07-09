const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * WebSocket Manager
 * Handles client connections, authentication, and request routing
 */
class WebSocketManager {
    constructor(httpServer, gameMoveQueryManager) {
        this.httpServer = httpServer;
        this.gameMoveQueryManager = gameMoveQueryManager;
        this.clients = new Map();
        this.clientStats = new Map();
        this.jwtSecret = process.env.JWT_SECRET || this.generateSecret();
        this.maxClientsPerIP = 5;
        this.rateLimitWindow = 60000; // 1 minute
        this.maxRequestsPerWindow = 100;
        
        this.setupSocketIO();
    }

    generateSecret() {
        return crypto.randomBytes(32).toString('hex');
    }

    setupSocketIO() {
        const { Server } = require('socket.io');
        
        this.io = new Server(this.httpServer, {
            cors: {
                origin: true,
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000,
            maxHttpBufferSize: 1e6, // 1MB limit
            allowEIO3: false
        });

        this.setupMiddleware();
        this.setupEventHandlers();
    }

    setupMiddleware() {
        // Authentication middleware
        this.io.use((socket, next) => {
            try {
                this.authenticateClient(socket, next);
            } catch (error) {
                console.error('[WebSocketManager] Authentication error:', error);
                next(new Error('Authentication failed'));
            }
        });

        // Rate limiting middleware
        this.io.use((socket, next) => {
            try {
                this.rateLimitClient(socket, next);
            } catch (error) {
                console.error('[WebSocketManager] Rate limit error:', error);
                next(new Error('Rate limit exceeded'));
            }
        });
    }

    authenticateClient(socket, next) {
        const clientIP = this.getClientIP(socket);
        const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
        
        // Check IP-based limits
        const ipConnections = Array.from(this.clients.values())
            .filter(client => client.ip === clientIP).length;
        
        if (ipConnections >= this.maxClientsPerIP) {
            console.warn(`[WebSocketManager] Too many connections from IP: ${clientIP}`);
            return next(new Error('Too many connections from this IP'));
        }

        // Generate client token
        const clientId = this.generateClientId();
        const token = jwt.sign(
            { 
                clientId, 
                ip: clientIP, 
                userAgent,
                timestamp: Date.now()
            },
            this.jwtSecret,
            { expiresIn: '24h' }
        );

        // Store client info
        socket.clientId = clientId;
        socket.token = token;
        socket.ip = clientIP;
        socket.userAgent = userAgent;

        console.log(`[WebSocketManager] Client authenticated: ${clientId} from ${clientIP}`);
        next();
    }

    rateLimitClient(socket, next) {
        const clientIP = this.getClientIP(socket);
        const now = Date.now();
        
        if (!this.clientStats.has(clientIP)) {
            this.clientStats.set(clientIP, {
                requests: [],
                lastCleanup: now
            });
        }

        const stats = this.clientStats.get(clientIP);
        
        // Clean old requests
        if (now - stats.lastCleanup > this.rateLimitWindow) {
            stats.requests = stats.requests.filter(
                timestamp => now - timestamp < this.rateLimitWindow
            );
            stats.lastCleanup = now;
        }

        // Check rate limit
        if (stats.requests.length >= this.maxRequestsPerWindow) {
            console.warn(`[WebSocketManager] Rate limit exceeded for IP: ${clientIP}`);
            return next(new Error('Rate limit exceeded'));
        }

        next();
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.handleClientConnection(socket);
        });
    }

    handleClientConnection(socket) {
        const clientId = socket.clientId;
        const clientIP = socket.ip;
        
        console.log(`[WebSocketManager] Client connected: ${clientId} from ${clientIP}`);

        // Store client
        this.clients.set(clientId, {
            socket,
            id: clientId,
            ip: clientIP,
            userAgent: socket.userAgent,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            requestCount: 0
        });

        // Setup client event handlers
        this.setupClientEventHandlers(socket);

        // Send welcome message
        socket.emit('connected', {
            clientId,
            token: socket.token,
            serverTime: Date.now()
        });
    }

    setupClientEventHandlers(socket) {
        const clientId = socket.clientId;

        // Handle analysis requests
        socket.on('analysisRequest', (request) => {
            this.handleAnalysisRequest(socket, request);
        });

        // Handle analysis cancellation
        socket.on('cancelAnalysis', (data) => {
            this.handleCancelAnalysis(socket, data);
        });

        // Handle client ping
        socket.on('ping', () => {
            this.updateClientActivity(clientId);
            socket.emit('pong', { serverTime: Date.now() });
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            this.handleClientDisconnection(socket, reason);
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error(`[WebSocketManager] Client error for ${clientId}:`, error);
        });
    }

    handleAnalysisRequest(socket, request) {
        const clientId = socket.clientId;
        const clientIP = socket.ip;
        
        try {
            // Validate request
            if (!this.validateAnalysisRequest(request)) {
                socket.emit('analysisError', {
                    requestId: request.requestId,
                    message: 'Invalid analysis request'
                });
                return;
            }

            // Update client stats
            this.updateClientActivity(clientId);
            this.updateClientStats(clientIP);

            // Log request
            console.log(`[WebSocketManager] Analysis request from ${clientId}:`, {
                requestId: request.requestId,
                gameId: request.gameId,
                moveNumber: request.moveNumber
            });

            // Forward to game move query manager
            this.gameMoveQueryManager.processAnalysisRequest(request, socket);

        } catch (error) {
            console.error(`[WebSocketManager] Error processing analysis request:`, error);
            socket.emit('analysisError', {
                requestId: request.requestId,
                message: 'Internal server error'
            });
        }
    }

    handleCancelAnalysis(socket, data) {
        const clientId = socket.clientId;
        
        console.log(`[WebSocketManager] Cancel analysis request from ${clientId}:`, data);
        
        // Forward to game move query manager
        this.gameMoveQueryManager.cancelAnalysisRequest(data.requestId, socket);
    }

    handleClientDisconnection(socket, reason) {
        const clientId = socket.clientId;
        
        console.log(`[WebSocketManager] Client disconnected: ${clientId}, reason: ${reason}`);
        
        // Remove client
        this.clients.delete(clientId);
        
        // Cancel any pending requests for this client
        this.gameMoveQueryManager.cancelClientRequests(socket);
    }

    validateAnalysisRequest(request) {
        if (!request || typeof request !== 'object') {
            return false;
        }

        const required = ['requestId', 'gameId', 'moves', 'metadata'];
        for (const field of required) {
            if (!request.hasOwnProperty(field)) {
                console.warn(`[WebSocketManager] Missing required field: ${field}`);
                return false;
            }
        }

        // Validate moves array
        if (!Array.isArray(request.moves)) {
            console.warn(`[WebSocketManager] Invalid moves array`);
            return false;
        }

        // Validate metadata
        if (!request.metadata || typeof request.metadata !== 'object') {
            console.warn(`[WebSocketManager] Invalid metadata object`);
            return false;
        }

        return true;
    }

    updateClientActivity(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.lastActivity = Date.now();
        }
    }

    updateClientStats(clientIP) {
        const now = Date.now();
        
        if (!this.clientStats.has(clientIP)) {
            this.clientStats.set(clientIP, {
                requests: [],
                lastCleanup: now
            });
        }

        const stats = this.clientStats.get(clientIP);
        stats.requests.push(now);

        // Increment request count for client
        for (const client of this.clients.values()) {
            if (client.ip === clientIP) {
                client.requestCount++;
            }
        }
    }

    getClientIP(socket) {
        return socket.handshake.headers['x-forwarded-for'] || 
               socket.handshake.address || 
               socket.conn.remoteAddress || 
               'unknown';
    }

    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API methods
    getConnectedClients() {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            ip: client.ip,
            connectedAt: client.connectedAt,
            lastActivity: client.lastActivity,
            requestCount: client.requestCount
        }));
    }

    getClientStats() {
        return {
            totalClients: this.clients.size,
            clientsByIP: this.groupClientsByIP(),
            requestStats: this.getRequestStats()
        };
    }

    groupClientsByIP() {
        const grouped = {};
        for (const client of this.clients.values()) {
            if (!grouped[client.ip]) {
                grouped[client.ip] = 0;
            }
            grouped[client.ip]++;
        }
        return grouped;
    }

    getRequestStats() {
        const stats = {};
        for (const [ip, data] of this.clientStats) {
            stats[ip] = {
                recentRequests: data.requests.length,
                lastRequest: data.requests[data.requests.length - 1] || null
            };
        }
        return stats;
    }

    sendToClient(clientId, event, data) {
        const client = this.clients.get(clientId);
        if (client && client.socket) {
            client.socket.emit(event, data);
            return true;
        }
        return false;
    }

    sendToAllClients(event, data) {
        for (const client of this.clients.values()) {
            if (client.socket) {
                client.socket.emit(event, data);
            }
        }
    }

    disconnectClient(clientId, reason = 'Server disconnection') {
        const client = this.clients.get(clientId);
        if (client && client.socket) {
            client.socket.disconnect(reason);
            this.clients.delete(clientId);
            return true;
        }
        return false;
    }

    shutdown() {
        console.log('[WebSocketManager] Shutting down...');
        
        // Disconnect all clients
        for (const client of this.clients.values()) {
            if (client.socket) {
                client.socket.disconnect('Server shutdown');
            }
        }
        
        // Close Socket.IO server
        if (this.io) {
            this.io.close();
        }
        
        // Clear data structures
        this.clients.clear();
        this.clientStats.clear();
    }
}

module.exports = WebSocketManager; 