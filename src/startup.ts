/**
 * startup.ts — Message affiché quand l'app ne peut pas démarrer.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§7)
 *
 * Au lieu d'une page blanche : une configuration manquante se signale à la
 * personne qui gère l'app ; le reste (réseau, mise à jour en cours) se règle
 * souvent en rechargeant la page.
 */

export function startupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.startsWith('Configuration manquante')) {
    return "L'app ne peut pas démarrer : configuration manquante. Préviens la personne qui gère ScanDrinks."
  }
  return "L'app ne peut pas démarrer. Recharge la page ; si ça continue, préviens la personne qui gère ScanDrinks."
}
