type PendingResponse = {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timeoutId?: number;
};

export class AIChildProcess {
  private command: Deno.Command;
  private process: Deno.ChildProcess;
  private stdin: WritableStreamDefaultWriter<Uint8Array>;
  private stdout: ReadableStreamDefaultReader<Uint8Array>;
  private stderr: ReadableStreamDefaultReader<Uint8Array>;
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private pendingById = new Map<string, PendingResponse>();
  private pendingWithoutId: PendingResponse[] = [];
  private closed = false;

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
    this.startStdoutReader();
    this.startStderrReader();
  }

  public async ProcessIOWriter(data: string): Promise<void> {
    const encodedData = new TextEncoder().encode(data);
    await this.stdin.ready;
    await this.stdin.write(encodedData);
  }

  /**
   * Send a JSON query to KataGo and resolve only the matching response id.
   * This avoids stale/timed-out stdout reads being consumed by later requests.
   */
  public async query(
    payload: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<string> {
    const id = typeof payload.id === "string" ? payload.id : undefined;
    if (!id) throw new Error("KataGo query requires a string id");
    if (this.pendingById.has(id)) {
      throw new Error(`KataGo query id already pending: ${id}`);
    }

    const responsePromise = new Promise<string>((resolve, reject) => {
      const pending: PendingResponse = { resolve, reject };
      if (timeoutMs && timeoutMs > 0) {
        pending.timeoutId = setTimeout(() => {
          this.pendingById.delete(id);
          reject(new Error("Analysis timeout"));
        }, timeoutMs);
      }
      this.pendingById.set(id, pending);
    });

    try {
      await this.ProcessIOWriter(JSON.stringify(payload) + "\n");
    } catch (error) {
      this.rejectPendingId(
        id,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }

    return await responsePromise;
  }

  /** Legacy API: resolves with the next unmatched stdout JSON line. */
  public async ProcessIOReader(timeoutMs?: number): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const pending: PendingResponse = { resolve, reject };
      if (timeoutMs && timeoutMs > 0) {
        pending.timeoutId = setTimeout(() => {
          const index = this.pendingWithoutId.indexOf(pending);
          if (index >= 0) this.pendingWithoutId.splice(index, 1);
          reject(new Error("Analysis timeout"));
        }, timeoutMs);
      }
      this.pendingWithoutId.push(pending);
    });
  }

  public async ProcessIOError(): Promise<string> {
    return await new Promise<string>((resolve) => {
      const check = () => {
        const newline = this.stderrBuffer.indexOf("\n");
        if (newline >= 0) {
          const line = this.stderrBuffer.slice(0, newline).trim();
          this.stderrBuffer = this.stderrBuffer.slice(newline + 1);
          resolve(line);
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  public readAvailableStdout(): Promise<string> {
    return Promise.resolve("");
  }

  public readAvailableStderr(): Promise<string> {
    const output = this.stderrBuffer;
    this.stderrBuffer = "";
    return Promise.resolve(output);
  }

  public ProcessKill(): void {
    this.closed = true;
    this.rejectAllPending(new Error("KataGo process killed"));
    try {
      this.stdin.close();
    } catch {
      // Already closed.
    }
    try {
      this.process.kill();
    } catch {
      // Already exited.
    }
  }

  private startStdoutReader(): void {
    const decoder = new TextDecoder();
    (async () => {
      try {
        while (!this.closed) {
          const { value, done } = await this.stdout.read();
          if (done) break;
          if (!value) continue;
          this.stdoutBuffer += decoder.decode(value, { stream: true });
          this.flushStdoutLines();
        }
      } catch (error) {
        this.rejectAllPending(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();
  }

  private startStderrReader(): void {
    const decoder = new TextDecoder();
    (async () => {
      try {
        while (!this.closed) {
          const { value, done } = await this.stderr.read();
          if (done) break;
          if (!value) continue;
          this.stderrBuffer += decoder.decode(value, { stream: true });
        }
      } catch {
        // Stderr is diagnostic only.
      }
    })();
  }

  private flushStdoutLines(): void {
    while (true) {
      const newline = this.stdoutBuffer.indexOf("\n");
      if (newline < 0) return;
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line) this.routeStdoutLine(line);
    }
  }

  private routeStdoutLine(line: string): void {
    let id: string | undefined;
    try {
      const parsed = JSON.parse(line) as { id?: unknown };
      if (typeof parsed.id === "string") id = parsed.id;
    } catch {
      // Non-JSON output is treated as an unmatched legacy response.
    }

    if (id) {
      const pending = this.pendingById.get(id);
      if (pending) {
        this.pendingById.delete(id);
        this.resolvePending(pending, line);
        return;
      }
      // Stale response from a timed-out request. Drop it intentionally.
      return;
    }

    const legacyPending = this.pendingWithoutId.shift();
    if (legacyPending) this.resolvePending(legacyPending, line);
  }

  private resolvePending(pending: PendingResponse, value: string): void {
    if (pending.timeoutId) clearTimeout(pending.timeoutId);
    pending.resolve(value);
  }

  private rejectPendingId(id: string, error: Error): void {
    const pending = this.pendingById.get(id);
    if (!pending) return;
    this.pendingById.delete(id);
    if (pending.timeoutId) clearTimeout(pending.timeoutId);
    pending.reject(error);
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingById) {
      this.pendingById.delete(id);
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    for (const pending of this.pendingWithoutId.splice(0)) {
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
  }
}
