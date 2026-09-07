/**
 * The canonical public origin, used for metadataBase, sitemap and robots.
 *
 * Vercel exposes VERCEL_PROJECT_PRODUCTION_URL on every deployment of a
 * project, so production and previews both resolve to the real production
 * host — which is what canonical URLs and OG images should point at.
 * NEXT_PUBLIC_SITE_URL overrides it once a custom domain is attached.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "Inboxproof";
