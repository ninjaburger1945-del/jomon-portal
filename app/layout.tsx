import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
// ⚠️ Google Fonts removed for Cloudflare Pages compatibility (Turbopack issue)
// System fonts fallback used in globals.css
import Footer from "./components/Footer";
import "./globals.css";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Jomon Portal",
  description: "日本全国の縄文遺跡・博物館・資料館を網羅するポータルサイト。",
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  noStore();
  const _h = headers();
  return (
    <html lang="ja">
      <head>
        {/* Google AdSense */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9282110631520988"
          crossOrigin="anonymous"
        ></script>
        {/* Google Analytics 4 */}
        {process.env.NEXT_PUBLIC_GA4_ID ? (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA4_ID}`}
            ></script>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA4_ID}');
                `,
              }}
            ></script>
          </>
        ) : null}
      </head>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}

// ISR disabled to prevent excessive Vercel Function executions
// export const revalidate = 3600;
