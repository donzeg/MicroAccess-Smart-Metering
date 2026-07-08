const normalize = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  const input = value as Record<string, unknown>;
  const sortedKeys = Object.keys(input).sort();
  const result: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    result[key] = normalize(input[key]);
  }

  return result;
};

export const canonicalStringify = (value: unknown): string => {
  return JSON.stringify(normalize(value));
};
