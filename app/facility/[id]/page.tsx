import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import facilitiesData from "../../data/facilities.json";
import newsData from "../../data/news.json";

interface Facility {
    id: string;
    name: string;
    region: string;
    prefecture: string;
    address: string;
    description: string;
    url: string;
    thumbnail: string;
    tags: string[];
    twitter?: string;
    access?: {
        info: string;
        rank: "S" | "A" | "B";
        advice: string;
    };
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

    return {
        title: `${facility.name} | 縄文博物館・資料館ポータル`,
        description: `${facility.prefecture}にある${facility.name}の施設情報、最新トピック、アクセス情報。${facility.description.substring(0, 100)}`,
    };
}

export default async function FacilityPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const facility = facilitiesData.find((f) => f.id === id) as Facility | undefined;

    if (!facility) {
        notFound();
    }

    const facilityNews = newsData.filter((news) => news.facilityId === id);

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Museum",
        "name": facility.name,
        "description": facility.description,
        "url": facility.url,
        "image": facility.thumbnail,
        "address": {
            "@type": "PostalAddress",
            "addressLocality": facility.prefecture,
            "streetAddress": facility.address,
            "addressCountry": "JP"
        }
    };

    const isAiGenerated = (f: any) => {
        // 未設定の場合は動的にPollinations AIから生成されるためAI画像扱い
        if (!f.thumbnail) return true;
        
        // プロジェクト内に保存されている .png の画像は以前AIで一括生成されたもの（640x640）
        if (f.thumbnail.endsWith('.png') && f.thumbnail.startsWith('/images/')) return true;
        
        // それ以外（外部URLの直リンクや、拡張子が.jpgの実写画像など）は本物の写真とみなす
        return false;
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
                    <p className={styles.location}>📍 {facility.address}</p>
                </header>

                {/* Thumbnail Section */}
                <div className={styles.imageWrapper}>
                    <Image
                        src={facility.thumbnail || `https://image.pollinations.ai/prompt/${encodeURIComponent(`Jomon period archaeological site, ${facility.name}, ${facility.tags.join(' ')}, photorealistic, cinematic lighting, ancient Japan landscape, highly detailed nature`)}?width=1200&height=600&nologo=true&seed=${facility.id}`}
                        alt={facility.name}
                        fill
                        className={styles.image}
                        priority
                        unoptimized={!facility.thumbnail}
                    />
                    {isAiGenerated(facility) && (
                        <div className={styles.aiBadgeDetailed}>AI Visualized</div>
                    )}
                </div>
                {isAiGenerated(facility) && (
                    <p className={styles.aiAnnotationDetailed}>
                        ※このイラストは遺跡の情報を元にAIで生成されたイメージ図です。
                    </p>
                )}

                {/* Main Content */}
                <div className={styles.contentGrid}>
                    <section className={styles.mainInfo}>
                        <h2 className={styles.sectionTitle}>施設概要</h2>
                        <p className={styles.description}>{facility.description}</p>

                        {facility.access ? (
                            <div className={styles.accessSection}>
                                <h2 className={styles.sectionTitle}>アクセス情報</h2>
                                <div className={styles.accessBox}>
                                    <div className={styles.accessHeader}>
                                        <span className={`${styles.rankBadge} ${styles[`rank${facility.access.rank}`]}`}>
                                            難易度 {facility.access.rank}
                                        </span>
                                        <p className={styles.accessInfoText}>{facility.access.info}</p>
                                    </div>
                                    <div className={styles.adviceBubble}>
                                        <div className={styles.senpaiIcon}>👦 遺跡少年</div>
                                        <p className={styles.adviceText}>{facility.access.advice}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.accessSection}>
                                <h2 className={styles.sectionTitle}>アクセス情報</h2>
                                <p className={styles.fallbackText}>現在、詳細なアクセス情報を準備中です。</p>
                            </div>
                        )}

                        <div className={styles.linkBox}>
                            {facility.url ? (
                                <a
                                    href={facility.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.officialBtn}
                                >
                                    <span>公式サイトを見る（外部サイト）</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                </a>
                            ) : (
                                <div className={styles.officialBtnDisabled}>
                                    <span>公式サイト：準備中</span>
                                </div>
                            )}
                        </div>
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
