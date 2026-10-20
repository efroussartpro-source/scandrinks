/**
 * passwordAuth.ts — Le changement de mot de passe branché sur Supabase Auth.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.6, §6.4)
 *
 * La déconnexion de tous les téléphones passe par le jeton de celui-ci, sans
 * toucher à sa session : si elle échoue, « Réessayer » reste possible. Seule
 * la dernière étape déconnecte ce téléphone.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PasswordAuth } from './changePassword'

export function createPasswordAuth(client: SupabaseClient, email: string, beforeLocalSignOut: () => void): PasswordAuth {
  return {
    async signIn(password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      return { error }
    },
    async updatePassword(password, currentPassword) {
      const { error } = await client.auth.updateUser({ password, current_password: currentPassword })
      return { error }
    },
    async signOutEverywhere() {
      const { data } = await client.auth.getSession()
      if (!data.session) return { error: new Error('Session absente') }
      const { error } = await client.auth.admin.signOut(data.session.access_token, 'global')
      return { error }
    },
    async signOutLocal() {
      beforeLocalSignOut()
      await client.auth.signOut({ scope: 'local' })
    },
  }
}
