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
              日本列島に1万年以上続いた「縄文文化」。その豊かな足跡を現代に掘り起こし、全国の縄文遺跡を網羅することを目指したポータルサイトです。
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>サイト設立の背景</h2>
            <p>2026年現在、全国の縄文遺跡を網羅した総合サイトは、残念ながらネット上に存在しませんでした。一人の縄文ファンとして「各地の遺跡を横断的に知りたい」と願う一方、膨大な数の遺跡を手作業で更新し続けることの困難さも痛感しておりました。</p>
            <p>しかし今、AIの力を借りることで、この理想としていたサイト構築が可能になりました。本サイトは、テクノロジーの力で「縄文の今」を支える挑戦でもあります。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>AIと紡ぐ、日々の更新</h2>
            <p>最新のAI技術を活用し、全国に点在する縄文遺跡の情報を毎日1件ずつ丁寧に追加しています。これまで見落とされがちだった地域の小さな史跡にも光を当て、皆様の新しい旅の候補地としてお届けします。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>「現地」へのリスペクト</h2>
            <p>当サイトの最終目的は、皆様が「実際に現地へ足を運ぶこと」です。そのため、各自治体や博物館の公式サイトへの正確なリンクとアクセス情報の掲載に最もこだわっています。週末の旅の計画表としてご活用ください。</p>
            <p className={styles.note}>※ご注意：掲載情報の正確性には細心の注意を払っておりますが、開館時間や公共交通機関の時刻表などは変更される場合があります。ご訪問の際は、必ずリンク先の公式サイト等で最新の情報をご確認ください。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>AIイラストの役割</h2>
            <p>掲載しているイラストは、遺跡の情報を元にAIが当時の情景を再解釈したイメージ図です。多くの遺跡では実写写真の利用に著作権や許諾の壁がありますが、AI生成を活用することで、それらをクリアしつつ「当時の空気感」を視覚的に補完する更新スタイルを採用しています。</p>
            <p className={styles.note}>※関係機関の皆様へ：実写写真への差し替えや内容の修正、掲載の取り下げ等のご要望がございましたら、<a href="https://forms.gle/tU9VMU4mLtGBstrf7" target="_blank" rel="noopener noreferrer">お問い合わせフォーム</a>よりご連絡ください。真摯に対応させていただきます。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>管理人より</h2>
            <p>縄文の風を、AIという窓を通じて感じていただければ幸いです。</p>
          </section>

          <footer className={styles.meta}>
            <p>運営者：Jomon Portal 運営事務局</p>
          </footer>

        </article>
      </main>
    </div>
  );
}

