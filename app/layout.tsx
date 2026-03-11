import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Footer from "./components/Footer";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "縄文博物館・資料館ポータル | JOMON PORTAL",
  description: "日本全国の縄文遺跡・博物館・資料館を網羅するポータルサイト。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable}`}>
        {children}
        <Footer />
      </body>
    </html>
  );
}
