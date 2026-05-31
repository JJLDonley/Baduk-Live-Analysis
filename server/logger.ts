const DEBUG_VALUES = ["1", "true", "on", "yes", "debug"];

let envDebugEnabled = false;
let requestDebugEnabled = false;
let debugSessions = 0;

function isDebugValue(value: string | null): boolean {
  return DEBUG_VALUES.includes((value ?? "").trim().toLowerCase());
}

try {
  envDebugEnabled = isDebugValue(Deno.env.get("DEBUG")) ||
    isDebugValue(Deno.env.get("BLA_DEBUG"));
} catch {
  envDebugEnabled = false;
}

function isEnabled(): boolean {
  return envDebugEnabled || requestDebugEnabled || debugSessions > 0;
}

export function setLoggerDebug(enabled: boolean): void {
  requestDebugEnabled = enabled;
}

function getDebugParam(url: URL): string | null {
  return url.searchParams.get("db") ?? url.searchParams.get("debug");
}

export function enableLoggerFromUrl(url: URL): void {
  requestDebugEnabled = url.searchParams.has("db") ||
    isDebugValue(getDebugParam(url));
}

export function startLoggerDebugSession(url: URL): boolean {
  const enabled = url.searchParams.has("db") ||
    isDebugValue(getDebugParam(url));
  if (enabled) debugSessions++;
  return enabled;
}

export function endLoggerDebugSession(enabled: boolean): void {
  if (enabled) debugSessions = Math.max(0, debugSessions - 1);
}

function write(method: "log" | "info" | "warn" | "error", args: unknown[]) {
  if (!isEnabled()) return;
  globalThis.console[method](...args);
}

export const logger = {
  get enabled() {
    return isEnabled();
  },
  log: (...args: unknown[]) => write("log", args),
  info: (...args: unknown[]) => write("info", args),
  warn: (...args: unknown[]) => write("warn", args),
  error: (...args: unknown[]) => write("error", args),
};
