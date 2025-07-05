const path = require('path');

class Config {
    constructor() {
        this.parseArguments();
    }

    parseArguments() {
        const args = process.argv.slice(2);
        
        // Default values
        this.katago = {
            dir: './katago',
            exe: 'katago.exe',
            config: 'default_config.cfg',
            model: 'default_model.bin.gz'
        };
        
        this.port = 2468;
        this.ogsUrl = 'https://online-go.com';
        
        // Parse command-line arguments
        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '-dir':
                    if (i + 1 < args.length) {
                        this.katago.dir = args[i + 1];
                        i++;
                    }
                    break;
                case '-exe':
                    if (i + 1 < args.length) {
                        this.katago.exe = args[i + 1];
                        i++;
                    }
                    break;
                case '-c':
                    if (i + 1 < args.length) {
                        this.katago.config = args[i + 1];
                        i++;
                    }
                    break;
                case '-m':
                    if (i + 1 < args.length) {
                        this.katago.model = args[i + 1];
                        i++;
                    }
                    break;
                case '-p':
                case '--port':
                    if (i + 1 < args.length) {
                        this.port = parseInt(args[i + 1]);
                        i++;
                    }
                    break;
                case '-h':
                case '--help':
                    this.showHelp();
                    process.exit(0);
                    break;
            }
        }
        
        // Build full paths
        this.katago.exePath = path.join(this.katago.dir, this.katago.exe);
        this.katago.configPath = path.join(this.katago.dir, this.katago.config);
        this.katago.modelPath = path.join(this.katago.dir, this.katago.model);
    }

    showHelp() {
        console.log(`
Baduk Live Analysis Server

Usage: node app.js [options]

Options:
  -dir <path>      KataGo directory (default: ./katago)
  -exe <name>      KataGo executable name (default: katago.exe)
  -c <file>        Config file name (default: default_config.cfg)
  -m <file>        Model file name (default: default_model.bin.gz)
  -p, --port <n>   Server port (default: 2468)
  -h, --help       Show this help message

Example:
  node app.js -dir katago/ -exe katago -c default_config.cfg -m default_model.bin.gz
        `);
    }

    getKataGoConfig() {
        return {
            exe: this.katago.exePath,
            config: this.katago.configPath,
            model: this.katago.modelPath
        };
    }
}

module.exports = new Config(); 