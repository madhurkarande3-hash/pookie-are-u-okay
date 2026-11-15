import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/nunito";
import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-sans-devanagari";
import "./globals.css";
import { PREFS_STORAGE_KEY, THEMES, themeCss } from "@/lib/theme/tokens";
import { PrefsProvider } from "@/state/PrefsProvider";
import { SessionProvider } from "@/state/SessionProvider";

export const metadata: Metadata = {
  title: "Pookie — A little care, a lot of love",
  description: "A gentle companion for older adults: friendly check-ins, medicine reminders, a Care Circle you control, and a LifeBook of your own memories.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: THEMES.sweet.bg };

/** Applies saved theme, text size and motion settings before first paint (no flash). */
const PREFS_BOOTSTRAP = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_STORAGE_KEY)})||"{}"),r=document.documentElement;if(p.pookie)r.dataset.pookie=p.pookie;if(p.textSize)r.dataset.text=p.textSize;if(p.reduceMotion)r.dataset.motion="off";if(p.language)r.lang=p.language}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-pookie="sweet" data-text="normal" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOTSTRAP }} />
      </head>
      <body>
        <PrefsProvider>
          <SessionProvider>{children}</SessionProvider>
        </PrefsProvider>
      </body>
    </html>
  );
}
