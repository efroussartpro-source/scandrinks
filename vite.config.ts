// Configuration Vite + Vitest. defineConfig vient de vitest/config :
// celui de vite refuse le champ `test` à la vérification des types.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
