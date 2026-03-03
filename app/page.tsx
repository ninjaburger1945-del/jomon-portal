import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import facilitiesData from "./data/facilities.json";

export default function Home() {
  return (
    <main>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>JOMON PORTAL</h1>
          <p className={styles.heroSubtitle}>時を越えて、日本の原風景に出会う</p>
        </div>
      </header>

      <section className={`${styles.section} container`}>
        <h2 className={styles.sectionTitle}>注目の縄文スポット</h2>
        <div className={styles.grid}>
          {facilitiesData.map((facility) => (
            <Link href={`/facility/${facility.id}`} key={facility.id} className={styles.card}>
              <div className={styles.cardImageWrapper}>
                <Image
                  src={facility.thumbnail}
                  alt={facility.name}
                  fill
                  className={styles.cardImage}
                />
              </div>
              <div className={styles.cardContent}>
                <div>
                  {facility.tags.map(tag => (
                    <span key={tag} className={styles.cardTag}>{tag}</span>
                  ))}
                </div>
                <h3 className={styles.cardTitle}>{facility.name}</h3>
                <span className={styles.cardRegion}>{facility.prefecture}</span>
                <p className={styles.cardText}>
                  {facility.description.length > 60
                    ? facility.description.substring(0, 60) + "..."
                    : facility.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.eventsSection}`}>
        <div className="container">
          <h2 className={styles.sectionTitle}>各施設の新着情報</h2>
          <p style={{ textAlign: 'center', opacity: 0.8 }}>
            全国の縄文施設から最新のワークショップ・展示情報を自動収集しています。
            <br />（※第2フェーズにてFirebase連携と一緒に実装予定）
          </p>
        </div>
      </section>
    </main>
  );
}
