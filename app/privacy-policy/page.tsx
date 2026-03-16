import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "プライバシーポリシー | JOMON PORTAL",
  description: "Jomon Portal（jomon-portal.jp）のプライバシーポリシーです。",
};

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>← トップへ戻る</Link>
        <h1 className={styles.title}>プライバシーポリシー</h1>
        <p className={styles.domain}>jomon-portal.jp</p>
      </header>

      <main className={styles.main}>
        <article className={styles.article}>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. 個人情報の利用目的</h2>
            <p>当サイト「Jomon Portal（jomon-portal.jp）」では、お問い合わせの際、名前やメールアドレス等の個人情報を入力いただく場合がございます。取得した個人情報は、お問い合わせに対する回答や必要な情報を電子メールなどでご連絡する場合に利用させていただくものであり、これらの目的以外では利用いたしません。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. 広告の配信について</h2>
            <p>当サイトは、第三者配信の広告サービス「Googleアドセンス」を利用しています。</p>
            <p>広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、クッキー（Cookie）を使用することがあります。クッキーを使用することで当サイトはお客様のコンピュータを識別できるようになりますが、お客様個人を特定できるものではありません。</p>
            <p>Cookieを無効にする方法やGoogleアドセンスに関する詳細は「広告 – ポリシーと規約 – Google」をご確認ください。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. アクセス解析ツールについて</h2>
            <p>当サイトでは、Googleによるアクセス解析ツール「Googleアナリティクス」を利用しています。このGoogleアナリティクスはトラフィックデータの収集のためにクッキー（Cookie）を使用しています。トラフィックデータは匿名で収集されており、個人を特定するものではありません。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. 免責事項</h2>
            <p>当サイトからのリンクやバナーなどで移動したサイトで提供される情報、サービス等について一切の責任を負いません。</p>
            <p>また、当サイトのコンテンツ・情報について、できる限り正確な情報を提供するよう努めておりますが、正確性や安全性を保証するものではありません。情報が古くなっていることもございます。当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. 著作権・肖像権について</h2>
            <p>当サイトで掲載しているすべてのコンテンツ（文章、画像、動画、音声など）の著作権・肖像権等は、当サイト所有者または各権利所有者が保有し、許可なく無断転載することを禁止します。</p>
            <p>なお、当サイトではAIによって生成されたイメージ画像を使用している箇所があり、それらについては「AI生成画像」である旨を明記し、適切に運用しております。</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. 本ポリシーの変更</h2>
            <p>当サイトは、個人情報に関して適用される日本の法令を遵守するとともに、本ポリシーの内容を適宜見直しその改善に努めます。修正された最新のプライバシーポリシーは常に本ページにて開示されます。</p>
          </section>

          <footer className={styles.meta}>
            <p>制定日：2026年3月16日</p>
            <p>運営者：Jomon Portal 運営事務局</p>
          </footer>

        </article>
      </main>
    </div>
  );
}
