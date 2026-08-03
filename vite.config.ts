/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    // src/engine/ é TS puro: os testes do motor rodam em Node, sem DOM.
    // Quando houver testes de UI, eles optam por jsdom por arquivo
    // (`// @vitest-environment jsdom` no topo do arquivo).
    environment: 'node',
  },
})
