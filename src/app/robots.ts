import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pookie-are-u-okay.vercel.app";

/** Public pages may be indexed; personal screens, the care-team area and the API may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacy", "/llms.txt"], disallow: ["/admin", "/api/", "/home", "/companion", "/checkin", "/medications", "/appointments", "/lifebook", "/family", "/circle", "/settings", "/health", "/emergency", "/simple", "/remember", "/reminders", "/onboarding/"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
