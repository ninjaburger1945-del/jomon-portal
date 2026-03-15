import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import facilitiesData from "../../data/facilities.json";
import newsData from "../../data/news.json";

const REGION_LABELS: Record<string, string> = {
  "Hokkaido": "北海道",
  "Tohoku":   "東北",
  "Kanto":    "関東",
  "Chubu":    "中部",
  "Kinki":    "近畿",
  "Chugoku":  "中国",
  "Shikoku":  "四国",
  "Kyushu":   "九州",
  "Okinawa":  "沖縄",
};

const REGION_COLORS: Record<string, string> = {
  "Hokkaido": "#1A5276",
  "Tohoku":   "#2E6B35",
  "Kanto":    "#1B6FA8",
  "Chubu":    "#7A5C1E",
  "Kinki":    "#6B3A6E",
  "Chugoku":  "#1A7070",
  "Shikoku":  "#8A4B1A",
  "Kyushu":   "#9B2B2B",
  "Okinawa":  "#0E8C7A",
};

interface Facility {
    id: string;
    name: string;
    region: string;
    prefecture: string;
    address: string;
    description: string;
    copy?: string;
    url: string;
    thumbnail: string;
    tags: string[];
    lat?: number;
    lng?: number;
    twitter?: string;
    access?: {
        info?: string;
        advice?: string;
        train?: string;
        bus?: string;
        car?: string;
        rank: "S" | "A" | "B" | "C";
    };
}

/** 電車フィールドに「徒歩X分」が含まれ、X≤10 のとき true */
function isWalkableFromStation(train?: string): boolean {
    if (!train) return false;
    const m = train.match(/徒歩[約]*(\d+)分/);
    return m ? parseInt(m[1]) <= 10 : false;
}

export async function generateStaticParams() {
    return facilitiesData.map((facility) => ({
        id: facility.id,
    }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const facility = facilitiesData.find((f) => f.id === id);
    if (!facility) return { title: '施設が見つかりません' };

    const tagStr = facility.tags.join('・');
    const descBase = facility.description ? facility.description.substring(0, 90) : '';
    return {
        title: `${facility.name}【${facility.prefecture}の縄文遺跡】| JOMON PORTAL`,
        description: `${facility.prefecture}の${tagStr}「${facility.name}」。アクセス情報・施設概要・公式リンクを掲載。${descBase}`,
        keywords: [facility.name, facility.prefecture, ...facility.tags, '縄文', '遺跡', '博物館', '縄文時代', 'JOMON PORTAL'],
        openGraph: {
            title: `${facility.name} | JOMON PORTAL`,
            description: `${facility.prefecture}の縄文遺跡・${tagStr}。${descBase}`,
            url: `https://jomon-portal.web.app/facility/${facility.id}/`,
            siteName: 'JOMON PORTAL',
            images: facility.thumbnail ? [{ url: `https://jomon-portal.web.app${facility.thumbnail}`, alt: facility.name }] : [],
            locale: 'ja_JP',
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${facility.name} | JOMON PORTAL`,
            description: `${facility.prefecture}の縄文遺跡・${tagStr}`,
        },
    };
}

export default async function FacilityPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const facility = facilitiesData.find((f) => f.id === id) as Facility | undefined;

    if (!facility) {
        notFound();
    }

    const facilityNews = newsData.filter((news) => news.facilityId === id);

    const schemaType = facility.tags.some(t => ["博物館", "資料館"].includes(t))
        ? "Museum"
        : "LandmarksOrHistoricalBuildings";

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": [schemaType, "TouristAttraction"],
        "name": facility.name,
        "description": facility.description,
        "url": facility.url || undefined,
        "image": facility.thumbnail || undefined,
        "address": {
            "@type": "PostalAddress",
            "addressLocality": facility.prefecture,
            "streetAddress": facility.address,
            "addressCountry": "JP"
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": (facility as any).lat,
            "longitude": (facility as any).lng,
        },
        "touristType": "縄文時代の歴史・文化に関心がある方",
    };

    return (
        <main className={styles.container}>
            {/* 構造化データの埋め込み */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* Navigation */}
            <nav className={styles.nav}>
                <Link href="/" className={styles.backLink}>
                    &larr; トップページに戻る
                </Link>
            </nav>

            <article className={styles.article}>
                {/* Header Section */}
                <header className={styles.header}>
                    <div className={styles.tags}>
                        {facility.tags.map(tag => (
                            <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                    </div>
                    <h1 className={styles.title}>{facility.name}</h1>
                    <div className={styles.regionMeta}>
                        <span
                            className={styles.regionTag}
                            style={{ backgroundColor: REGION_COLORS[facility.region] ?? '#666' }}
                        >
                            {REGION_LABELS[facility.region]}
                        </span>
                        <span className={styles.prefLabel}>{facility.prefecture}</span>
                    </div>
                    <p className={styles.location}>📍 {facility.address}</p>
                </header>

                {/* Thumbnail Section */}
                <div className={styles.imageWrapper}>
                    <Image
                        src={facility.thumbnail || `https://image.pollinations.ai/prompt/${encodeURIComponent(`Jomon period archaeological site, ${facility.id.replace(/-/g, ' ')}, photorealistic, cinematic lighting, ancient Japan landscape, highly detailed nature`)}?width=1200&height=600&nologo=true`}
                        alt={`${facility.name} のAI生成イメージイラスト`}
                        fill
                        className={styles.image}
                        priority
                    />
                </div>
                <p className={styles.aiAnnotationDetailed}>
                    ※このイラストは遺跡の情報を元にAIで生成されたイメージ図です。
                </p>

                {/* Action Buttons */}
                <div className={styles.actionButtons}>
                    {facility.url ? (
                        <a
                            href={facility.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.actionBtn}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                            公式サイト
                        </a>
                    ) : (
                        <span className={styles.actionBtnDisabled}>公式サイト（準備中）</span>
                    )}
                    {facility.lat && facility.lng ? (
                        <a
                            href={`https://maps.google.com/?q=${facility.lat},${facility.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.actionBtn} ${styles.actionBtnMap}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            地図アプリで開く
                        </a>
                    ) : null}
                </div>

                {/* Main Content */}
                <div className={styles.contentGrid}>
                    <section className={styles.mainInfo}>
                        <h2 className={styles.sectionTitle}>施設概要</h2>
                        <p className={styles.description}>{facility.description}</p>

                        {facility.access ? (
                            <div className={styles.accessSection}>
                                <h2 className={styles.sectionTitle}>アクセス情報</h2>
                                <div className={styles.accessBox}>
                                    {facility.access.train ? (
                                        <div className={styles.accessSections}>
                                            <div className={styles.accessRow}>
                                                <span className={styles.accessModeLabel}>🚌 公共交通機関</span>
                                                <p className={styles.accessInfoText}>
                                                    {isWalkableFromStation(facility.access.train) || !facility.access.bus
                                                        ? facility.access.train
                                                        : `${facility.access.train}。${facility.access.bus}`}
                                                </p>
                                            </div>
                                            {facility.access.car && (
                                                <div className={styles.accessRow}>
                                                    <span className={styles.accessModeLabel}>🚗 車</span>
                                                    <p className={styles.accessInfoText}>{facility.access.car}</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className={styles.accessInfoText}>{facility.access.info}</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className={styles.accessSection}>
                                <h2 className={styles.sectionTitle}>アクセス情報</h2>
                                <p className={styles.fallbackText}>現在、詳細なアクセス情報を準備中です。</p>
                            </div>
                        )}

                    </section>

                    <aside className={styles.sidebar}>
                        <div className={styles.widget}>
                            <h3 className={styles.widgetTitle}>最新トピック</h3>
                            {facilityNews.length > 0 ? (
                                <ul className={styles.newsList}>
                                    {facilityNews.map((item, idx) => (
                                        <li key={idx} className={styles.newsItem}>
                                            <span className={styles.newsDate}>{item.date}</span>
                                            <a href={item.link} target="_blank" rel="noopener noreferrer" className={styles.newsLink}>
                                                {item.title}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className={styles.widgetText}>
                                    現在、最新のお知らせはありません。
                                </p>
                            )}
                        </div>

                        {facility.twitter && (
                            <div className={styles.widget}>
                                <h3 className={styles.widgetTitle}>公式X（Twitter）</h3>
                                <div className={styles.twitterWrapper}>
                                    <a className="twitter-timeline" data-height="400" href={facility.twitter}>Tweets by {facility.name}</a>
                                    <script async src="https://platform.twitter.com/widgets.js" charSet="utf-8"></script>
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </article>
        </main>
    );
}
