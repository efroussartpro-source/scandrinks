/**
 * useCatalog.ts — Catalogue partagé : les produits et leur stock.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.3, §4.4)
 *
 * Chargé une fois connecté, relu au retour dans l'app et à la demande
 * (changement d'onglet, action faite sur ce téléphone). Pas de mise à jour en
 * direct : moins de 30 produits, et la fiche du Scanner lit toujours le stock
 * du moment. Une réponse arrivée après une lecture plus récente est ignorée ;
 * un échec garde la liste précédente.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Product } from '../data/api'
import { classifyApiError, type ApiErrorKind } from '../data/apiErrors'
import { api } from '../data/supabaseClient'

export interface Catalog {
  products: Product[] | null
  errorKind: ApiErrorKind | null
  updatedAt: Date | null
  refresh: () => void
}

export function useCatalog(options: { enabled: boolean; onSessionExpired: () => void }): Catalog {
  const { enabled, onSessionExpired } = options
  const [products, setProducts] = useState<Product[] | null>(null)
  const [errorKind, setErrorKind] = useState<ApiErrorKind | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const requestId = useRef(0)

  // Valeurs lues au moment d'une lecture, sans recréer refresh quand elles changent.
  const latest = useRef({ enabled, onSessionExpired })
  useEffect(() => {
    latest.current = { enabled, onSessionExpired }
  })

  const refresh = useCallback(() => {
    if (!latest.current.enabled) return
    const id = ++requestId.current
    api.listCatalog().then(
      (list) => {
        if (id !== requestId.current) return
        setProducts(list)
        setErrorKind(null)
        setUpdatedAt(new Date())
      },
      (error: unknown) => {
        if (id !== requestId.current) return
        const kind = classifyApiError(error).kind
        if (kind === 'session') latest.current.onSessionExpired()
        else setErrorKind(kind)
      },
    )
  }, [])

  // Connexion : première lecture. Déconnexion : plus rien n'est gardé.
  useEffect(() => {
    if (enabled) {
      refresh()
      return
    }
    requestId.current += 1
    setProducts(null)
    setErrorKind(null)
    setUpdatedAt(null)
  }, [enabled, refresh])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refresh])

  return { products, errorKind, updatedAt, refresh }
}
