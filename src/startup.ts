/**
 * startup.ts — Message affiché quand l'app ne peut pas démarrer.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§7)
 *
 * Au lieu d'une page blanche : une configuration manquante se signale à la
 * personne qui gère l'app ; le reste (réseau coupé pendant le chargement,
 * mise à jour en cours) se règle souvent en rechargeant. L'app installée n'a
 * ni barre ni geste pour recharger : l'écran porte alors un bouton.
 */

export function isConfigurationMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith('Configuration manquante')
}

export function startupErrorMessage(error: unknown): string {
  if (isConfigurationMissing(error)) {
    return "L'app ne peut pas démarrer : configuration manquante. Préviens la personne qui gère ScanDrinks."
  }
  return "L'app ne peut pas démarrer. Touche « Recharger » ; si ça continue, préviens la personne qui gère ScanDrinks."
}
