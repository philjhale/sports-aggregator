/**
 * In-memory stand-in for `localStorage`. Pre-seed with `initial`, or pass
 * `{ throws: true }` to simulate blocked storage (private mode, quota).
 */
export function createMemoryStorage(
  initial: Record<string, string> = {},
  options: { throws?: boolean } = {},
): Storage {
  const data = new Map<string, string>(Object.entries(initial));
  const guard = () => {
    if (options.throws) throw new DOMException('Storage is unavailable', 'SecurityError');
  };
  return {
    get length() {
      guard();
      return data.size;
    },
    key(index) {
      guard();
      return [...data.keys()][index] ?? null;
    },
    getItem(key) {
      guard();
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      guard();
      data.set(key, String(value));
    },
    removeItem(key) {
      guard();
      data.delete(key);
    },
    clear() {
      guard();
      data.clear();
    },
  };
}
