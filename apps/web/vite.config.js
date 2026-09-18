import { defineConfig } from 'vite';
import { cpSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Páginas que Vite tiene que compilar (React/JSX). Sumar acá cada vista nueva hecha con React.
const PAGINAS_REACT = ['Supervisor-Empleados.html'];

// El resto de las páginas son HTML + <script src="..."> clásicos (sin type="module"):
// Vite no los empaqueta ni los emite, así que se copian tal cual a dist.
const NO_ESTATICOS = new Set([
  'index.html', // stub de Vite (apunta a /src/main.jsx); / redirige a InicioSesion.html
  'vite.config.js',
  'vercel.json',
  'package.json',
  'package-lock.json',
  'README.md',
]);

function copiarEstaticos() {
  return {
    name: 'copiar-estaticos',
    apply: 'build',
    closeBundle() {
      const raiz = __dirname;
      const destino = resolve(raiz, 'dist');
      for (const archivo of readdirSync(raiz)) {
        const esEstatico = /\.(html|js|css)$/.test(archivo);
        if (!esEstatico || NO_ESTATICOS.has(archivo) || PAGINAS_REACT.includes(archivo)) continue;
        cpSync(resolve(raiz, archivo), resolve(destino, archivo));
      }
    },
  };
}

export default defineConfig({
  plugins: [copiarEstaticos()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        PAGINAS_REACT.map((archivo) => [archivo.replace('.html', ''), resolve(__dirname, archivo)])
      ),
    },
  },
});
