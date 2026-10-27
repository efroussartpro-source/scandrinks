/**
 * deletion.ts — Les textes de la suppression d'un produit (RG-15, jalon 6).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-15)
 *
 * La question posée avant d'effacer, puis le message que montre la liste
 * d'où la fiche avait été ouverte (Stock ou À racheter).
 */

export function deleteConfirmMessage(name: string): string {
  return `Supprimer « ${name} » pour de bon ? Ses codes et tout son historique (entrées, sorties, ventes, inventaires) seront effacés. Impossible de revenir en arrière.`
}

export function deletedMessage(name: string): string {
  return `${name} a été supprimé.`
}
