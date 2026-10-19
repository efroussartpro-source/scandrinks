/**
 * deduper.ts — Anti-doublon des lectures.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§7)
 * Un code n'est pas relu tant qu'il reste dans le champ de la caméra, ni
 * avant SCAN_COOLDOWN_MS sans l'avoir vu. Chaque code a sa propre mémoire :
 * le code d'un pack et celui d'une canette vue à travers le film ne
 * s'empêchent pas l'un l'autre.
 */

export const SCAN_COOLDOWN_MS = 2000

/** Renvoie une fonction qui dit si un code lu doit être pris en compte. */
export function createScanDeduper(
  cooldownMs: number = SCAN_COOLDOWN_MS,
  now: () => number = Date.now,
): (code: string) => boolean {
  const lastSeen = new Map<string, number>()

  return (code: string) => {
    const t = now()
    for (const [seenCode, seenAt] of lastSeen) {
      if (t - seenAt >= cooldownMs) lastSeen.delete(seenCode)
    }
    const accepted = !lastSeen.has(code)
    lastSeen.set(code, t)
    return accepted
  }
}
