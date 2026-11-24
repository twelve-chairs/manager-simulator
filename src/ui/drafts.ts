/**
 * Reads a JSON object the UI saved in a draft field, or an empty object when it is missing, not JSON, or not an
 * object. Drafts are the UI's own in-memory state, but a parse that cannot throw keeps a screen drawing whatever a
 * draft holds.
 */
export function draftObject<V>(field: string | undefined): Record<string, V> {
  if (!field) return {};
  try {
    const value: unknown = JSON.parse(field);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return value as Record<string, V>;
  } catch {
    return {};
  }
}
