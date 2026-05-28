export interface AnalysisSettings {
  maxVisits?: number;
  includePolicy?: boolean;
  includeOwnership?: boolean;
}

export function normalizeAnalysisSettings(
  payload: unknown,
  serverMaxVisits: number,
): AnalysisSettings | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const settings: AnalysisSettings = {};

  if (record.maxVisits !== undefined) {
    const maxVisits = Number(record.maxVisits);
    if (!Number.isFinite(maxVisits) || maxVisits < 1) return null;
    settings.maxVisits = Math.min(Math.floor(maxVisits), serverMaxVisits);
  }

  if (record.includePolicy !== undefined) {
    if (typeof record.includePolicy !== "boolean") return null;
    settings.includePolicy = record.includePolicy;
  }

  if (record.includeOwnership !== undefined) {
    if (typeof record.includeOwnership !== "boolean") return null;
    settings.includeOwnership = record.includeOwnership;
  }

  return settings;
}

export function mergeAnalysisSettings(
  base: AnalysisSettings,
  override: AnalysisSettings,
): AnalysisSettings {
  return {
    maxVisits: override.maxVisits ?? base.maxVisits,
    includePolicy: override.includePolicy ?? base.includePolicy,
    includeOwnership: override.includeOwnership ?? base.includeOwnership,
  };
}
