import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP, Shippori_Mincho } from "next/font/google";
import Footer from "./components/Footer";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori-mincho",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "JOMON PORTAL",
  description: "日本全国の縄文遺跡・博物館・資料館を網羅するポータルサイト。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      <body className={`${notoSansJP.variable} ${notoSerifJP.variable} ${shipporiMincho.variable}`}>
        {children}
        <Footer />
      </body>
    </html>
  );
}

export const revalidate = 60;
