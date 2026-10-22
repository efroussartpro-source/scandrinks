/// <reference types="vite/client" />

// Variables publiques lues au moment de la construction (.env.production, .env.e2e).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_SHOP_EMAIL: string
  // Premier jour de ventes de la fin de journée (AAAA-MM-JJ), ou rien : voir sales/SalesScreen.tsx.
  readonly VITE_FIRST_SALES_DAY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
