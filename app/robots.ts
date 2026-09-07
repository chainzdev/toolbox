import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Shared scan reports are per-visitor snapshots: thousands of
        // near-identical pages that would dilute the site rather than rank.
        // They stay publicly reachable by link, just not crawled. /dashboard
        // and /login need a session and have nothing to index.
        disallow: ["/api/", "/dashboard", "/login", "/report/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
