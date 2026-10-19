/**
 * supabaseClient.ts — Client Supabase de l'app et instance `api` des écrans.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.4)
 *
 * La clé utilisée est la clé publique du projet, publique par conception : la
 * sécurité vient de la Row Level Security et de la table allowed_users. La
 * session reste enregistrée sur le téléphone et se renouvelle seule. L'URL
 * n'est jamais lue ni modifiée (iOS redemanderait l'autorisation caméra).
 */
import { createClient } from '@supabase/supabase-js'
import { createApi } from './api'

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Configuration manquante : ${name} (voir .env.production).`)
  return value
}

export const SHOP_EMAIL = requireEnv('VITE_SHOP_EMAIL', import.meta.env.VITE_SHOP_EMAIL)

export const supabase = createClient(
  requireEnv('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
)

export const api = createApi(supabase)
