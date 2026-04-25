// Mutation timestamp tracking
// Prevents polling from overwriting recent mutation updates

const lastMutationTime = new Map<string, number>();

export function markMutationRecent(key: string) {
  lastMutationTime.set(key, Date.now());
}

export function wasMutationRecent(key: string, withinMs = 5000): boolean {
  const last = lastMutationTime.get(key);
  if (!last) return false;
  return Date.now() - last < withinMs;
}

export function clearMutationTime(key: string) {
  lastMutationTime.delete(key);
}
