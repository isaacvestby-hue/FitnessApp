import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://<user>.github.io/FitnessApp/
export default defineConfig({
  base: '/FitnessApp/',
  plugins: [react()],
})
