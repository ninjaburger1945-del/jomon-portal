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
          <Link href="/privacy-policy" className={styles.linkBtn}>
            プライバシーポリシー
          </Link>
        </nav>
        <p className={styles.copyright}>
          &copy; 2026 JOMON PORTAL &nbsp;·&nbsp; jomon-portal.jp
        </p>
      </div>
    </footer>
  );
}
