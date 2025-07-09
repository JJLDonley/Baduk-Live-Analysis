import { join, resolve } from "https://deno.land/std/path/mod.ts";

export interface ServerConfig {
    // Server settings
    port: number;
    host: string;
    
    // KataGo settings
    katago: {
        directory: string;
        executable: string;
        model: string;
        config: string;
    };
    
    // Analysis settings
    analysis: {
        maxVisits: number;
        maxConcurrentAnalyses: number;
        timeoutMs: number;
        includePolicy: boolean;
        includeOwnership: boolean;
    };
    
    // Logging
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error';
        logFile?: string;
    };
}

export class ConfigManager {
    private config: ServerConfig;
    private configFile: string;
    
    constructor(configFile: string = 'config.json') {
        this.configFile = configFile;
        this.config = this.getDefaultConfig();
    }
    
    private getDefaultConfig(): ServerConfig {
        return {
            port: 8081,
            host: '0.0.0.0',
            katago: {
                directory: './server/katago',
                executable: 'katago.exe',
                model: 'weights.bin.gz',
                config: 'default.cfg'
            },
            analysis: {
                maxVisits: 10,
                maxConcurrentAnalyses: 1,
                timeoutMs: 30000,
                includePolicy: false,
                includeOwnership: true
            },
            logging: {
                level: 'info'
            }
        };
    }
    
    public async loadConfig(): Promise<ServerConfig> {
        try {
            // Check if config file exists
            const configText = await Deno.readTextFile(this.configFile);
            const loadedConfig = JSON.parse(configText);
            
            // Merge with defaults to ensure all properties exist
            this.config = this.mergeConfigs(this.getDefaultConfig(), loadedConfig);
            
            console.log(`[Config] Configuration loaded from ${this.configFile}`);
            return this.config;
            
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
                console.log(`[Config] Configuration file ${this.configFile} not found, creating default...`);
                await this.saveConfig();
                return this.config;
            } else {
                console.error(`[Config] Error loading configuration:`, error);
                console.log(`[Config] Using default configuration`);
                return this.config;
            }
        }
    }
    
    public async saveConfig(): Promise<void> {
        try {
            const configText = JSON.stringify(this.config, null, 2);
            await Deno.writeTextFile(this.configFile, configText);
            console.log(`[Config] Configuration saved to ${this.configFile}`);
        } catch (error) {
            console.error(`[Config] Error saving configuration:`, error);
        }
    }
    
    private mergeConfigs(defaultConfig: ServerConfig, loadedConfig: any): ServerConfig {
        return {
            port: loadedConfig.port || defaultConfig.port,
            host: loadedConfig.host || defaultConfig.host,
            katago: {
                directory: loadedConfig.katago?.directory || defaultConfig.katago.directory,
                executable: loadedConfig.katago?.executable || defaultConfig.katago.executable,
                model: loadedConfig.katago?.model || defaultConfig.katago.model,
                config: loadedConfig.katago?.config || defaultConfig.katago.config
            },
            analysis: {
                maxVisits: loadedConfig.analysis?.maxVisits || defaultConfig.analysis.maxVisits,
                maxConcurrentAnalyses: loadedConfig.analysis?.maxConcurrentAnalyses || defaultConfig.analysis.maxConcurrentAnalyses,
                timeoutMs: loadedConfig.analysis?.timeoutMs || defaultConfig.analysis.timeoutMs,
                includePolicy: loadedConfig.analysis?.includePolicy !== undefined ? loadedConfig.analysis.includePolicy : defaultConfig.analysis.includePolicy,
                includeOwnership: loadedConfig.analysis?.includeOwnership !== undefined ? loadedConfig.analysis.includeOwnership : defaultConfig.analysis.includeOwnership
            },
            logging: {
                level: loadedConfig.logging?.level || defaultConfig.logging.level,
                logFile: loadedConfig.logging?.logFile || defaultConfig.logging.logFile
            }
        };
    }
    
    public getConfig(): ServerConfig {
        return this.config;
    }
    
    public updateConfig(updates: Partial<ServerConfig>): void {
        this.config = this.mergeConfigs(this.config, updates);
    }
    
    public getKataGoExecutablePath(): string {
        // Resolve absolute path from working directory + relative path
        return resolve(join(Deno.cwd(), this.config.katago.directory, this.config.katago.executable));
    }
    
    public getKataGoModelPath(): string {
        return resolve(join(Deno.cwd(), this.config.katago.directory, this.config.katago.model));
    }
    
    public getKataGoConfigPath(): string {
        return resolve(join(Deno.cwd(), this.config.katago.directory, this.config.katago.config));
    }
    
    public validateConfig(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // Check if KataGo files exist
        const executablePath = this.getKataGoExecutablePath();
        const modelPath = this.getKataGoModelPath();
        const configPath = this.getKataGoConfigPath();
        
        try {
            Deno.statSync(executablePath);
        } catch {
            errors.push(`KataGo executable not found at: ${executablePath}`);
        }
        
        try {
            Deno.statSync(modelPath);
        } catch {
            errors.push(`KataGo model not found at: ${modelPath}`);
        }
        
        try {
            Deno.statSync(configPath);
        } catch {
            errors.push(`KataGo config not found at: ${configPath}`);
        }
        
        // Validate port
        if (this.config.port < 1 || this.config.port > 65535) {
            errors.push(`Invalid port number: ${this.config.port}`);
        }
        
        // Validate analysis settings
        if (this.config.analysis.maxVisits < 1) {
            errors.push(`Max visits must be at least 1`);
        }
        
        if (this.config.analysis.maxConcurrentAnalyses < 1) {
            errors.push(`Max concurrent analyses must be at least 1`);
        }
        
        if (this.config.analysis.timeoutMs < 1000) {
            errors.push(`Timeout must be at least 1000ms`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// Command-line argument parser
export class ArgumentParser {
    private args: string[];
    
    constructor(args: string[]) {
        this.args = args;
    }
    
    public parseArgs(): Partial<ServerConfig> {
        const config: any = {};
        
        for (let i = 0; i < this.args.length; i++) {
            const arg = this.args[i];
            const nextArg = this.args[i + 1];
            
            switch (arg) {
                case '--port':
                case '-p':
                    if (nextArg) {
                        config.port = parseInt(nextArg);
                        i++;
                    }
                    break;
                    
                case '--host':
                case '-h':
                    if (nextArg) {
                        config.host = nextArg;
                        i++;
                    }
                    break;
                    
                case '--katago-dir':
                    if (nextArg) {
                        config.katago = { directory: nextArg };
                        i++;
                    }
                    break;
                    
                case '--katago-exe':
                    if (nextArg) {
                        if (!config.katago) config.katago = {};
                        config.katago.executable = nextArg;
                        i++;
                    }
                    break;
                    
                case '--katago-model':
                    if (nextArg) {
                        if (!config.katago) config.katago = {};
                        config.katago.model = nextArg;
                        i++;
                    }
                    break;
                    
                case '--katago-config':
                    if (nextArg) {
                        if (!config.katago) config.katago = {};
                        config.katago.config = nextArg;
                        i++;
                    }
                    break;
                    
                case '--max-visits':
                    if (nextArg) {
                        if (!config.analysis) config.analysis = {};
                        config.analysis.maxVisits = parseInt(nextArg);
                        i++;
                    }
                    break;
                    
                case '--max-concurrent':
                    if (nextArg) {
                        if (!config.analysis) config.analysis = {};
                        config.analysis.maxConcurrentAnalyses = parseInt(nextArg);
                        i++;
                    }
                    break;
                    
                case '--timeout':
                    if (nextArg) {
                        if (!config.analysis) config.analysis = {};
                        config.analysis.timeoutMs = parseInt(nextArg);
                        i++;
                    }
                    break;
                    
                case '--log-level':
                    if (nextArg) {
                        if (!config.logging) config.logging = {};
                        config.logging.level = nextArg;
                        i++;
                    }
                    break;
                    
                case '--log-file':
                    if (nextArg) {
                        if (!config.logging) config.logging = {};
                        config.logging.logFile = nextArg;
                        i++;
                    }
                    break;
                    
                case '--help':
                    this.printHelp();
                    Deno.exit(0);
                    break;
            }
        }
        
        return config;
    }
    
    private printHelp(): void {
        console.log(`
Baduk Live Analysis Server

Usage: deno run --allow-all server/server.ts [options]

Options:
  -p, --port <port>           Server port (default: 8081)
  -h, --host <host>           Server host (default: localhost)
  --katago-dir <directory>    KataGo directory path (default: ./katago)
  --katago-exe <executable>   KataGo executable name (default: katago.exe)
  --katago-model <model>      KataGo model file (default: default_model.bin.gz)
  --katago-config <config>    KataGo config file (default: default.cfg)
  --max-visits <visits>       Maximum visits per analysis (default: 100)
  --max-concurrent <count>    Maximum concurrent analyses (default: 3)
  --timeout <ms>              Analysis timeout in milliseconds (default: 30000)
  --log-level <level>         Logging level: debug, info, warn, error (default: info)
  --log-file <file>           Log file path (optional)
  --help                      Show this help message

Examples:
  deno run --allow-all server/server.ts --port 8082 --max-visits 200
  deno run --allow-all server/server.ts --katago-dir ./custom-katago --katago-exe katago
  deno run --allow-all server/server.ts --host 0.0.0.0 --port 8080
        `);
    }
} 