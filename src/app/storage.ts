/**
 * storage.ts — Lecture et écriture sûres dans le stockage du téléphone.
 *
 * En navigation privée ou avec les données de site bloquées, Safari peut
 * refuser localStorage, jusqu'à lever une exception au simple accès. L'app
 * continue alors sans mémoire : elle redemande ce qu'elle n'a pas pu garder.
 */

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readStored(key: string, storage: Storage | null = defaultStorage()): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string, storage: Storage | null = defaultStorage()): void {
  try {
    storage?.setItem(key, value)
  } catch {
    // Stockage refusé : la valeur sera simplement redemandée.
  }
}
