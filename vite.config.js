import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],

  server: {
    proxy: {
      // string shorthand: http://localhost:5173/api -> http://localhost:3000/api
      // We need to tell Vite to proxy any request starting with /api
      // to the target where our serverless functions are running.
      // By default, Vercel CLI runs them on port 3000.
      '/api': {
        target: 'http://localhost:3000', // The Vercel dev server
        changeOrigin: true,
        // Optional: you can remove the /api prefix if your target doesn't expect it
        // rewrite: (path) => path.replace(/^\/api/, ''), 
        // But for Vercel functions, we keep the /api prefix
      },
    }
  }

})
