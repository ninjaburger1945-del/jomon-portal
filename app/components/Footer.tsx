import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <nav className={styles.links}>
          <Link href="/about" className={styles.linkBtn}>
            このサイトについて
          </Link>
          <span className={styles.sep}>|</span>
          <Link href="/events" className={styles.linkBtn}>
            イベント情報
          </Link>
          <span className={styles.sep}>|</span>
          <Link href="/privacy-policy" className={styles.linkBtn}>
            プライバシーポリシー
          </Link>
          <span className={styles.sep}>|</span>
          <a
            href="https://forms.gle/tU9VMU4mLtGBstrf7"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkBtn}
          >
            お問い合わせ
          </a>
        </nav>
        <p className={styles.copyright}>
          &copy; 2026 JOMON PORTAL &nbsp;·&nbsp; jomon-portal.jp
        </p>
      </div>
    </footer>
  );
}
