import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Bakes this deployment's branding into the built index.html, so the title/favicon
// are correct on first paint instead of flashing Ayalot's defaults until the
// runtime settings fetch resolves. Set VITE_LIBRARY_NAME / VITE_LIBRARY_ICON_URL
// per Netlify site to brand a second deployment of this same codebase.
function htmlBranding() {
  const name = process.env.VITE_LIBRARY_NAME || 'Ayalot Library'
  const icon = process.env.VITE_LIBRARY_ICON_URL || '/favicon.png'
  return {
    name: 'html-branding',
    transformIndexHtml(html: string) {
      return html
        .replace('<title>Ayalot Library</title>', `<title>${name}</title>`)
        .replace('href="/favicon.png"', `href="${icon}"`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), htmlBranding()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.PORT) || 5173,
  },
})
