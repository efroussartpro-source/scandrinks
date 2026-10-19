/// <reference types="vite/client" />

// Variables publiques lues au moment de la construction (.env.production, .env.e2e).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_SHOP_EMAIL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
