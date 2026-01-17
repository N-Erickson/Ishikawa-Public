/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACLED_EMAIL?: string
  readonly VITE_ACLED_PASSWORD?: string
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
