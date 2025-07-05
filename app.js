const Queue = require("./src/queue.js");
const KataGo = require("./src/ai.js");
const { GameEntity, Board } = require("./src/game.js");
const { AIEXE, AICONFIG, AIMODEL, GAMES } = require("./src/constants.js");
const Server = require("./src/server.js");
const OGSConnection = require("./src/ogsConnection.js");

class BadukAnalysisApp {
    constructor() {
        this.ai = new KataGo(AIEXE, AICONFIG, AIMODEL);
        this.queue = new Queue();
        this.ogsConnection = new OGSConnection(this.queue, this.ai);
        this.server = new Server(this.ogsConnection);
        
        this.setupMonitoring();
    }

    setupMonitoring() {
        // Display application status every 5 minutes
        const interval = 5 * 60 * 1000; // 5 minutes in milliseconds
        setInterval(() => {
            this.displayData();
        }, interval);
    }

    displayData() {
        const library = {};
        for (const key in GAMES) {
            if (GAMES.hasOwnProperty(key)) {
                library[key] = typeof GAMES[key];
            }
        }

        console.log("Application Status:");
        console.log("Library: ", library);
    }

    start() {
        console.log("Starting Baduk Live Analysis Server...");
        this.server.start();
    }
}

// Create and start the application
const app = new BadukAnalysisApp();
app.start();
