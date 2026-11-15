/**
 * Builds the whole app (Demo Mode) into ONE self-contained HTML file:
 *   npm run build:single  →  web-single/dist/index.html
 * Same pages, components and logic as the Next.js app; only next/link and
 * next/navigation are swapped for small hash-routing shims.
 */
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import { PREFS_STORAGE_KEY, THEMES, themeCss } from "../src/lib/theme/tokens";

const root = fileURLToPath(new URL(".", import.meta.url));
const from = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const PREFS_BOOTSTRAP = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_STORAGE_KEY)})||"{}"),r=document.documentElement;if(p.pookie)r.dataset.pookie=p.pookie;if(p.textSize)r.dataset.text=p.textSize;if(p.reduceMotion)r.dataset.motion="off";if(p.language)r.lang=p.language}catch(e){}})();`;

function headInjection(): Plugin {
  return {
    name: "pookie-head",
    transformIndexHtml: (html) =>
      html.replace(
        "<!--pookie:head-->",
        `<meta name="theme-color" content="${THEMES.sweet.bg}" />\n<style>${themeCss()}</style>\n<script>${PREFS_BOOTSTRAP}</script>`,
      ),
  };
}

// Demo Mode only: no Firebase config is ever compiled into this build.
const env = ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID", "FUNCTIONS_REGION"].reduce<Record<string, string>>(
  (acc, k) => ({ ...acc, [`process.env.NEXT_PUBLIC_FIREBASE_${k}`]: JSON.stringify("") }),
  { "process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS": JSON.stringify("") },
);

export default defineConfig({
  root,
  plugins: [react(), headInjection(), viteSingleFile()],
  define: { ...env, "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: {
    alias: [
      { find: /^next\/navigation$/, replacement: from("./shims/next-navigation.ts") },
      { find: /^next\/link$/, replacement: from("./shims/next-link.tsx") },
      { find: /^@google\/genai$/, replacement: from("./shims/genai.ts") },
      { find: /^@shared\//, replacement: from("../functions/src/shared/") },
      { find: /^@\//, replacement: from("../src/") },
    ],
  },
  css: { postcss: { plugins: [tailwind({ config: from("../tailwind.config.ts") }), autoprefixer()] } },
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, target: "es2020" },
});
