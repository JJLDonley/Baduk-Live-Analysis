const express = require("express");
const path = require("path");
const { APP, HTTP_SERVER, PORT } = require("./constants.js");

class Server {
    constructor(ogsConnection) {
        this.ogsConnection = ogsConnection;
        this.requestCounts = new Map(); // Simple rate limiting storage
        this.setupRoutes();
    }

    // Simple rate limiting implementation
    rateLimitMiddleware(maxRequests = 100, windowMs = 60000) {
        return (req, res, next) => {
            const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const now = Date.now();
            const windowStart = now - windowMs;

            // Clean old entries
            for (const [ip, requests] of this.requestCounts.entries()) {
                this.requestCounts.set(ip, requests.filter(time => time > windowStart));
                if (this.requestCounts.get(ip).length === 0) {
                    this.requestCounts.delete(ip);
                }
            }

            // Check current IP
            if (!this.requestCounts.has(clientIP)) {
                this.requestCounts.set(clientIP, []);
            }

            const requests = this.requestCounts.get(clientIP);
            if (requests.length >= maxRequests) {
                console.warn(`Security: Rate limit exceeded for ${clientIP}`);
                return res.status(429).json({ error: "Too Many Requests" });
            }

            requests.push(now);
            next();
        };
    }

    setupRoutes() {
        // Apply rate limiting (100 requests per minute per IP)
        APP.use(this.rateLimitMiddleware(100, 60000));

        // Security headers for all responses
        APP.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' wss: ws:;");
            next();
        });

        // Security middleware - log all requests for monitoring
        APP.use((req, res, next) => {
            const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            console.log(`${new Date().toISOString()} - ${clientIP} - ${req.method} ${req.path}`);
            next();
        });

        // Health check endpoint
        APP.get("/health_check", (req, res) => {
            res.status(200).json({
                status: "healthy",
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // Root route - serve index.html
        APP.get("/", (req, res) => {
            res.sendFile(path.join(__dirname, "../web", "index.html"));
        });

        // Serve static files from web directory first (before catch-all routes)
        APP.use(express.static(path.join(__dirname, "../web"), {
            // Security options for static file serving
            dotfiles: 'deny', // Deny access to dotfiles
            index: false, // Don't serve directory indexes
            maxAge: '1d' // Cache static files for 1 day
        }));

        // Main route for game/demo/review with strict validation
        APP.get("/:type/:id", (req, res) => {
            const { type, id } = req.params;
            
            // Strict validation of type parameter
            if (!["game", "demo", "review"].includes(type)) {
                console.warn(`Security: Invalid game type attempted: ${type}`);
                return res.status(404).send("Not Found");
            }

            // Validate ID parameter (should be numeric for OGS games)
            if (!/^\d+$/.test(id)) {
                console.warn(`Security: Invalid game ID attempted: ${id}`);
                return res.status(404).send("Not Found");
            }

            console.log(`Game created: {"${id}": Game: {}}`);

            // If type is 'demo', change it to 'review'
            const adjustedType = type === "demo" ? "review" : type;

            // Connect to the live game if not already connected
            this.ogsConnection.connectLiveGame(adjustedType, id);

            // Serve index.html
            res.sendFile(path.join(__dirname, "../web", "index.html"));
        });

        // Catch-all route for security - deny everything else
        APP.use("*", (req, res) => {
            const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            console.warn(`Security: Blocked unauthorized access attempt from ${clientIP} to ${req.originalUrl}`);
            res.status(404).send("Not Found");
        });

        // Error handling middleware
        APP.use((err, req, res, next) => {
            console.error('Server error:', err);
            res.status(500).send("Internal Server Error");
        });
    }

    start() {
        HTTP_SERVER.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    }
}

module.exports = Server; 