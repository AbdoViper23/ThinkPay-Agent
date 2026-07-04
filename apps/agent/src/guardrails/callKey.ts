// Stable hash of (endpoint + normalized args) for duplicate-call detection (guardrail #3).
// Deterministic: object keys are sorted so arg order can't produce a different key.

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, normalize((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function callKey(endpoint: string, args: unknown): string {
  return `${endpoint}::${JSON.stringify(normalize(args) ?? null)}`;
}
