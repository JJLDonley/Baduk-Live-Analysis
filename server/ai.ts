export class AIChildProcess {
    private command: Deno.Command;
    private process: Deno.ChildProcess;
    private stdin: WritableStreamDefaultWriter<Uint8Array>;
    private stdout: ReadableStreamDefaultReader<Uint8Array>;
    private stderr: ReadableStreamDefaultReader<Uint8Array>;
    private stdoutBuffer = "";
    private stderrBuffer = "";

    constructor(executable: string, args: string[]) {
        this.command = new Deno.Command(executable, {
            args,
            stdin: "piped",
            stdout: "piped",
            stderr: "piped",
        });

        this.process = this.command.spawn();
        this.stdin = this.process.stdin.getWriter();
        this.stdout = this.process.stdout.getReader();
        this.stderr = this.process.stderr.getReader();
    }

    public async ProcessIOWriter(data: string): Promise<void> {
        const DataUint8Encoder = new TextEncoder();
        const EncodedUint8Data = DataUint8Encoder.encode(data);
        await this.stdin.ready;
        await this.stdin.write(EncodedUint8Data);
    }

    public async ProcessIOReader(): Promise<string> {
        let IOReadBuffer = "";
        const IOReadDecoder = new TextDecoder();
        
        while (true) {
            const { value: IOReadValue } = await this.stdout.read();
            IOReadBuffer += IOReadDecoder.decode(IOReadValue, { stream: true });

            // Check if we have a complete JSON object (balanced braces)
            if (IOReadBuffer.includes('{')) {
                let braceCount = 0;
                let inString = false;
                let escaped = false;
                
                for (let i = 0; i < IOReadBuffer.length; i++) {
                    const char = IOReadBuffer[i];
                    
                    if (escaped) {
                        escaped = false;
                        continue;
                    }
                    
                    if (char === '\\') {
                        escaped = true;
                        continue;
                    }
                    
                    if (char === '"' && !escaped) {
                        inString = !inString;
                        continue;
                    }
                    
                    if (!inString) {
                        if (char === '{') {
                            braceCount++;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                // We have a complete JSON object
                                return IOReadBuffer.trim();
                            }
                        }
                    }
                }
            }
            
            if (IOReadBuffer.endsWith("\n")) {
                return IOReadBuffer.trim();
            }
        }
    }

    public async ProcessIOError(): Promise<string> {
        let IOErrorBuffer = "";
        const IOErrorDecoder = new TextDecoder();
        while (true) {
            const { value: IOErrorValue } = await this.stderr.read();

            IOErrorBuffer += IOErrorDecoder.decode(IOErrorValue, { stream: true });

            if (IOErrorBuffer.endsWith("\n")) {
                return IOErrorBuffer.trim();
            }
        }
    }

    public async readAvailableStdout(): Promise<string> {
        try {
            const result = await Promise.race([
                this.stdout.read(),
                new Promise<{ done: true, value: undefined }>(resolve => 
                    setTimeout(() => resolve({ done: true, value: undefined }), 10)
                )
            ]);
            
            if (result.done || !result.value) return "";
            
            const chunk = new TextDecoder().decode(result.value, { stream: true });
            this.stdoutBuffer += chunk;
            
            const lines = this.stdoutBuffer.split('\n');
            if (lines.length > 1) {
                const completeLines = lines.slice(0, -1).join('\n');
                this.stdoutBuffer = lines[lines.length - 1];
                return completeLines;
            }
            
            return "";
        } catch (error) {
            return "";
        }
    }

    public async readAvailableStderr(): Promise<string> {
        try {
            const result = await Promise.race([
                this.stderr.read(),
                new Promise<{ done: true, value: undefined }>(resolve => 
                    setTimeout(() => resolve({ done: true, value: undefined }), 10)
                )
            ]);
            
            if (result.done || !result.value) return "";
            
            const chunk = new TextDecoder().decode(result.value, { stream: true });
            this.stderrBuffer += chunk;
            
            const lines = this.stderrBuffer.split('\n');
            if (lines.length > 1) {
                const completeLines = lines.slice(0, -1).join('\n');
                this.stderrBuffer = lines[lines.length - 1];
                return completeLines;
            }
            
            return "";
        } catch (error) {
            return "";
        }
    }

    public ProcessKill(): void {
        this.stdin.close();
        this.process.kill();
    }
}