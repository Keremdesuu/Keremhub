import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {cpSync} from 'node:fs';
import {resolve} from 'node:path';
export default defineConfig({base:'/drive/',plugins:[react(),tailwindcss(),{name:'local-pdf-resources',closeBundle(){for(const dir of ['cmaps','standard_fonts','wasm','iccs'])cpSync(resolve('node_modules/pdfjs-dist',dir),resolve('dist/pdfjs',dir),{recursive:true});}}],server:{proxy:{'/drive/api':'http://127.0.0.1:3400'}}});
