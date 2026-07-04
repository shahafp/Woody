/** Client-generated UUIDs everywhere — no server sequence coupling, sync-safe. */
export function newId(): string {
  return crypto.randomUUID()
}
