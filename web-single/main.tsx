/**
 * Single-file entry: renders the same pages and layouts as the Next.js app,
 * routed on the URL hash. Built with `npm run build:single` into one HTML file.
 */
import "@fontsource-variable/nunito";
import "@fontsource-variable/manrope";
import "@fontsource-variable/noto-sans-devanagari";
import "@/app/globals.css";
import { StrictMode, useEffect, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { PrefsProvider } from "@/state/PrefsProvider";
import { SessionProvider } from "@/state/SessionProvider";
import WelcomePage from "@/app/page";
import OnboardingLayout from "@/app/onboarding/layout";
import PookiePage from "@/app/onboarding/pookie/page";
import ProfilePage from "@/app/onboarding/profile/page";
import CirclePage from "@/app/onboarding/circle/page";
import ConsentPage from "@/app/onboarding/consent/page";
import AppLayout from "@/app/(app)/layout";
import HomePage from "@/app/(app)/home/page";
import CompanionPage from "@/app/(app)/companion/page";
import CheckinPage from "@/app/(app)/checkin/page";
import MedicationsPage from "@/app/(app)/medications/page";
import AppointmentsPage from "@/app/(app)/appointments/page";
import LifebookPage from "@/app/(app)/lifebook/page";
import FamilyPage from "@/app/(app)/family/page";
import CareCirclePage from "@/app/(app)/circle/page";
import SettingsPage from "@/app/(app)/settings/page";
import PrivacyPage from "@/app/privacy/page";
import { usePathname } from "./shims/next-navigation";
import type { RoutePath } from "./routes";

type Layout = ComponentType<{ children: ReactNode }>;
const PAGES: Record<RoutePath, [ComponentType, Layout | null]> = {
  "/": [WelcomePage, null],
  "/onboarding/pookie": [PookiePage, OnboardingLayout],
  "/onboarding/profile": [ProfilePage, OnboardingLayout],
  "/onboarding/circle": [CirclePage, OnboardingLayout],
  "/onboarding/consent": [ConsentPage, OnboardingLayout],
  "/home": [HomePage, AppLayout],
  "/companion": [CompanionPage, AppLayout],
  "/checkin": [CheckinPage, AppLayout],
  "/medications": [MedicationsPage, AppLayout],
  "/appointments": [AppointmentsPage, AppLayout],
  "/lifebook": [LifebookPage, AppLayout],
  "/family": [FamilyPage, AppLayout],
  "/circle": [CareCirclePage, AppLayout],
  "/settings": [SettingsPage, AppLayout],
  "/privacy": [PrivacyPage, null],
};

function Router() {
  const path = usePathname() as RoutePath;
  const [Page, Layout] = PAGES[path] ?? PAGES["/"];
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  const page = <Page key={path} />;
  return Layout ? <Layout>{page}</Layout> : page;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrefsProvider>
      <SessionProvider>
        <Router />
      </SessionProvider>
    </PrefsProvider>
  </StrictMode>,
);
