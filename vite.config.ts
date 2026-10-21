// Configuration Vite + Vitest. defineConfig vient de vitest/config :
// celui de vite refuse le champ `test` à la vérification des types.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Les feuilles de style sont lues pour de vrai : sans cela, Vitest les remplace par du vide,
    // y compris en ?raw, et le test de la charte (theme/charte.test.ts) ne verrait aucune couleur.
    css: { include: [/\.css(\?.*)?$/] },
  },
})
