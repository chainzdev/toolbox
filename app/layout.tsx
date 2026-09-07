import type { Metadata, Viewport } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const title = "Inboxproof — find out why your email lands in spam";
const description =
  "Free instant audit of your domain's SPF, DKIM, DMARC, MX and TLS records. See exactly what is broken, what it costs you, and the record to publish to fix it.";

export const metadata: Metadata = {
  /**
   * Without metadataBase, Next resolves Open Graph and canonical URLs against
   * an unknown host and warns on every build; social cards then point nowhere.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    // Child pages set only their own name; the brand is appended here so it
    // can never drift between routes.
    template: `%s — ${SITE_NAME}`,
  },
  description,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title, description },
  robots: { index: true, follow: true },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#0f1c2e",
  colorScheme: "light",
};

/**
 * Fonts are linked at runtime rather than pulled through next/font, which
 * downloads them during the build. That download is the one network call the
 * build depends on, and it is not worth failing a deploy over.
 */
const FONT_HREF =
  "https://fonts.googleapis.com/css2" +
  "?family=Archivo:wght@600;700;800" +
  "&family=Public+Sans:wght@400;500;600" +
  "&family=JetBrains+Mono:wght@400;500;600" +
  "&display=swap";

/**
 * Tells search engines this is a product with a free tier rather than an
 * article, and feeds the price into the result snippet.
 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description,
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    {
      "@type": "Offer",
      name: "Pro",
      price: "29",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "29",
        priceCurrency: "USD",
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: "MON",
      },
    },
    {
      "@type": "Offer",
      name: "Agency",
      price: "99",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "99",
        priceCurrency: "USD",
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: "MON",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONT_HREF} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </head>
      <body className="antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
