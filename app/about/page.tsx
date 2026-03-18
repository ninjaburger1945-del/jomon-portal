import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "このサイトについて | JOMON PORTAL",
  description: "Jomon Portalは、全国の縄文遺跡を網羅したポータルサイトです。AIが毎日1件ずつ情報を更新し、公式サイトへの正確なリンクと、遺跡ごとのAI生成イラストで当時の空気感をお届けします。",
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>← トップへ戻る</Link>
        <h1 className={styles.title}>このサイトについて</h1>
        <p className={styles.domain}>jomon-portal.jp</p>
      </header>

      <main className={styles.main}>
        <article className={styles.article}>

          <section className={styles.section}>
            <p>
              Jomon Portalは、全国の縄文遺跡を網羅したポータルサイトです。AIが毎日1件ずつ情報を更新し、公式サイトへの正確なリンクと、遺跡ごとのAI生成イラストで当時の空気感をお届けします。
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>AIによる日々の更新</h2>
            <p>AIを活用し、全国の縄文遺跡情報を毎日1件ずつ追加しています。これまで埋もれていた各地の史跡を掘り起こし、旅の候補地としてお届けします。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>公式リンクへのこだわり</h2>
            <p>自治体等の公式サイトへの正確なリンクとアクセス情報を掲載し、現地訪問の計画に役立てていただけるよう努めています。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>AIイラストについて</h2>
            <p>サイト内のイラストはAI生成です。考古学的事実をもとに当時の空気感を再解釈したイメージ図としてご利用ください。</p>
          </section>

          <footer className={styles.meta}>
            <p>運営者：Jomon Portal 運営事務局</p>
          </footer>

        </article>
      </main>
    </div>
  );
}

