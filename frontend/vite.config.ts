import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development Vite serves :5173 and forwards /v1 to the API on :8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/v1': 'http://localhost:8000' },
  },
})
