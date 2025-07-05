const express = require("express");
const path = require("path");
const { APP, HTTP_SERVER, PORT } = require("./constants.js");

class Server {
    constructor(ogsConnection) {
        this.ogsConnection = ogsConnection;
        this.setupRoutes();
    }

    setupRoutes() {
        // Serve static files
        APP.use(express.static(path.join(__dirname, "../web")));

        // Main route for game/demo/review
        APP.get("/:type/:id", (req, res) => {
            const { type, id } = req.params;
            console.log(`Game created: {"${id}": Game: {}}`);
            
            // Validate the type
            if (!["game", "demo", "review"].includes(type)) {
                return res.status(400).send("Error: Not a proper type.");
            }

            // If type is 'demo', change it to 'review'
            const adjustedType = type === "demo" ? "review" : type;

            // Connect to the live game if not already connected
            this.ogsConnection.connectLiveGame(adjustedType, id);

            // Serve index.html
            res.sendFile(path.join(__dirname, "../web", "index.html"));
        });
    }

    start() {
        HTTP_SERVER.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    }
}

module.exports = Server; 