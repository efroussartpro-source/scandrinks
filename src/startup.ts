/**
 * startup.ts — Messages affichés quand l'app ne peut pas démarrer, ou ne peut plus afficher un écran.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2, §7)
 *
 * Au lieu d'une page blanche : une configuration manquante se signale à la
 * personne qui gère l'app ; le reste (réseau coupé pendant le chargement,
 * mise à jour en cours) se règle souvent en rechargeant. L'app installée n'a
 * ni barre ni geste pour recharger : l'écran porte alors un bouton. Une erreur
 * d'affichage imprévue, une fois l'app démarrée, a son propre message
 * (app/ErrorBoundary.tsx).
 */

export const RENDER_ERROR_MESSAGE =
  "L'app a rencontré un problème. Touche « Recharger » ; si ça continue, préviens la personne qui gère ScanDrinks."

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
