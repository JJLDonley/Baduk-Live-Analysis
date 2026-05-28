export class AnalysisCache<T> {
  private entries = new Map<string, T>();

  constructor(private readonly maxEntries: number) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("AnalysisCache maxEntries must be a positive integer");
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;

    // Refresh recency on read.
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }

    this.entries.set(key, value);
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
