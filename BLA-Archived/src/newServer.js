const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { AIManager } = require('./aiManager');
const WebSocketManager = require('./websocketManager');
const GameMoveQueryManager = require('./gameMoveQueryManager');
const config = require('./config');

/**
 * New Baduk Analysis Server
 * Clean architecture with proper separation of concerns
 */
class BadukAnalysisServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.port = config.port || 3000;
        
        // Initialize components
        this.aiManager = null;
        this.gameMoveQueryManager = null;
        this.websocketManager = null;
        
        this.setupSecurity();
        this.setupRoutes();
        this.initializeComponents();
    }

    setupSecurity() {
        // Helmet for security headers
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.socket.io"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "wss:", "ws:", "https://online-go.com"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"]
                }
            },
            crossOriginEmbedderPolicy: false // Allow WebSocket connections
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // Limit each IP to 1000 requests per windowMs
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res, next, options) => {
                console.warn(`Rate limit exceeded for IP: ${req.ip}`);
                res.status(options.statusCode).json({
                    error: options.message,
                    retryAfter: Math.round(options.windowMs / 1000)
                });
            }
        });

        this.app.use(limiter);

        // Request logging
        this.app.use((req, res, next) => {
            const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            console.log(`${new Date().toISOString()} - ${clientIP} - ${req.method} ${req.path}`);
            next();
        });

        // Body parsing with limits
        this.app.use(express.json({ limit: '1mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

        // Trust proxy for accurate IP addresses
        this.app.set('trust proxy', 1);
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                components: {
                    aiManager: this.aiManager ? this.aiManager.getStats() : null,
                    websocketManager: this.websocketManager ? this.websocketManager.getClientStats() : null,
                    gameMoveQueryManager: this.gameMoveQueryManager ? this.gameMoveQueryManager.getQueueStats() : null
                }
            });
        });

        // API endpoints
        this.app.get('/api/stats', (req, res) => {
            if (!this.isAuthenticated(req)) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            
            res.json({
                ai: this.aiManager ? this.aiManager.getStats() : null,
                websocket: this.websocketManager ? this.websocketManager.getClientStats() : null,
                queue: this.gameMoveQueryManager ? this.gameMoveQueryManager.getQueueStats() : null
            });
        });

        // Serve static files
        this.app.use(express.static(path.join(__dirname, '../web'), {
            dotfiles: 'deny',
            index: false,
            maxAge: '1d',
            setHeaders: (res, path) => {
                // Add security headers for static files
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('X-Frame-Options', 'DENY');
            }
        }));

        // Main route - serve index.html
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../web/index.html'));
        });

        // Game routes with validation
        this.app.get('/:type/:id', (req, res) => {
            const { type, id } = req.params;
            
            // Validate type
            if (!['game', 'demo', 'review'].includes(type)) {
                console.warn(`Invalid game type attempted: ${type}`);
                return res.status(404).json({ error: 'Invalid game type' });
            }

            // Validate ID
            if (!/^\d+$/.test(id)) {
                console.warn(`Invalid game ID attempted: ${id}`);
                return res.status(404).json({ error: 'Invalid game ID' });
            }

            // Log game access
            console.log(`Game accessed: ${type}/${id} from ${req.ip}`);

            // Serve index.html
            res.sendFile(path.join(__dirname, '../web/index.html'));
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            console.warn(`404 - Path not found: ${req.originalUrl} from ${req.ip}`);
            res.status(404).json({ error: 'Not found' });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            console.error('Server error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    initializeComponents() {
        try {
            // Initialize AI Manager
            const aiConfig = {
                executable: config.getKataGoConfig().exe,
                config: config.getKataGoConfig().config,
                model: config.getKataGoConfig().model,
                numProcesses: process.env.AI_PROCESSES || 1
            };
            
            this.aiManager = new AIManager(aiConfig);
            console.log('[Server] AI Manager initialized');

            // Initialize Game Move Query Manager
            this.gameMoveQueryManager = new GameMoveQueryManager(this.aiManager);
            console.log('[Server] Game Move Query Manager initialized');

            // Initialize WebSocket Manager
            this.websocketManager = new WebSocketManager(this.server, this.gameMoveQueryManager);
            console.log('[Server] WebSocket Manager initialized');

        } catch (error) {
            console.error('[Server] Error initializing components:', error);
            process.exit(1);
        }
    }

    isAuthenticated(req) {
        // Simple authentication check
        // In production, implement proper JWT or session-based auth
        const authHeader = req.headers.authorization;
        return authHeader && authHeader.startsWith('Bearer ');
    }

    start() {
        this.server.listen(this.port, '0.0.0.0', () => {
            console.log(`[Server] Baduk Analysis Server running on port ${this.port}`);
            console.log(`[Server] Visit http://localhost:${this.port} to access the application`);
        });

        // Handle graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    shutdown() {
        console.log('[Server] Shutting down gracefully...');
        
        // Close server
        this.server.close(() => {
            console.log('[Server] HTTP server closed');
        });

        // Shutdown components
        if (this.websocketManager) {
            this.websocketManager.shutdown();
        }
        
        if (this.gameMoveQueryManager) {
            this.gameMoveQueryManager.shutdown();
        }
        
        if (this.aiManager) {
            this.aiManager.shutdown();
        }
        
        // Exit process
        setTimeout(() => {
            console.log('[Server] Forced exit');
            process.exit(0);
        }, 10000);
    }
}

// Create and start server
const server = new BadukAnalysisServer();
server.start();

module.exports = BadukAnalysisServer; 