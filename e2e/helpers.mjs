/**
 * helpers.mjs — Aides communes au test de bout en bout (app-smoke.mjs) et aux captures (screens.mjs).
 */
import { GOOD_PASSWORD } from './fakeSupabase.mjs'

// Connexion avec le mot de passe factice, puis le prénom « Sam ».
export async function signIn(page) {
  await page.getByLabel('Mot de passe').fill(GOOD_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { name: 'Qui es-tu ?' }).waitFor()
  await page.getByLabel('Nouveau prénom').fill('Sam')
  await page.getByRole('button', { name: "C'est moi" }).click()
}
