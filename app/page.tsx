"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useEffect, useRef } from "react";
import styles from "./page.module.css";
import facilitiesData from "./data/facilities.json";

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

const REGION_ICONS: Record<string, string> = {
  "Hokkaido": "❄️",
  "Tohoku":   "🌲",
  "Kanto":    "🏺",
  "Chubu":    "⛰️",
  "Kinki":    "🌿",
  "Chugoku":  "🌊",
  "Shikoku":  "🌰",
  "Kyushu":   "🌋",
  "Okinawa":  "🌺",
};

const PRIORITY_TAGS = new Set(["世界遺産", "国宝", "重要文化財", "特別史跡", "特別名勝"]);

const PLACEHOLDER_PATTERNS = [
  /google\.com\/search/i,
  /bing\.com\/search/i,
  /search\.yahoo\.co\.jp/i,
  /example\.com/i,
  /localhost/i,
  /^#$/,
];

const isVerifiedUrl = (url: string) =>
  !!url && url.trim() !== "" && !PLACEHOLDER_PATTERNS.some(p => p.test(url));

const isLgJpUrl = (url: string) =>
  !!url && /\.(lg|go)\.jp/i.test(url);

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);
  const [showFloating, setShowFloating] = useState(false);

  const cardWrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleIndicesRef = useRef(new Set<number>());

  const todayFacility = facilitiesData[facilitiesData.length - 1];
  const allTags = Array.from(new Set(facilitiesData.flatMap(f => f.tags)));

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    facilitiesData.forEach(f => { counts[f.region] = (counts[f.region] || 0) + 1; });
    return counts;
  }, []);


  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleLocationSort = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSortByDistance(checked);
    if (checked && !userLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
            setLocationError("");
          },
          () => {
            setLocationError("現在地を取得できませんでした。ブラウザの設定を確認してください。");
            setSortByDistance(false);
          }
        );
      } else {
        setLocationError("お使いのブラウザは位置情報に対応していません。");
        setSortByDistance(false);
      }
    }
  };

  const filteredAndSortedFacilities = useMemo(() => {
    let result = facilitiesData.filter(facility => {
      const matchQuery =
        facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (facility.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        facility.prefecture.includes(searchQuery);
      const matchType = selectedType === "" || facility.tags.includes(selectedType);
      const matchRegion = selectedRegion === "" || facility.region === selectedRegion;
      return matchQuery && matchType && matchRegion;
    });

    if (sortByDistance && userLocation) {
      result.sort((a, b) =>
        calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
      );
    }
    return result;
  }, [searchQuery, selectedType, selectedRegion, sortByDistance, userLocation]);

  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, selectedType, selectedRegion]);

  useEffect(() => {
    observerRef.current?.disconnect();
    visibleIndicesRef.current.clear();

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const idx = parseInt(entry.target.getAttribute("data-card-index") || "0", 10);
        if (entry.isIntersecting) visibleIndicesRef.current.add(idx);
        else visibleIndicesRef.current.delete(idx);
      });
      if (visibleIndicesRef.current.size > 0) {
        setFirstVisibleIndex(Math.min(...visibleIndicesRef.current));
      }
    }, { threshold: 0.1, rootMargin: "-44px 0px 0px 0px" });

    cardWrapperRefs.current.forEach(el => {
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [filteredAndSortedFacilities, visibleCount]);

  useEffect(() => {
    const onScroll = () => {
      const distFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      setShowFloating(window.scrollY > 500 && distFromBottom > 160);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const getImageUrl = (facility: { thumbnail?: string; id: string }) => {
    if (facility.thumbnail) return facility.thumbnail;
    const prompt = encodeURIComponent(
      `Jomon period archaeological site, ${facility.id.replace(/-/g, " ")}, photorealistic, cinematic lighting, ancient Japan landscape, highly detailed nature`
    );
    return `https://image.pollinations.ai/prompt/${prompt}?width=600&height=400&nologo=true`;
  };

  const displayedFacilities = filteredAndSortedFacilities.slice(0, visibleCount);

  return (
    <>
      {/* Sticky bar */}
      <div className={styles.stickyBar}>
        <span className={styles.stickyBarText}>
          🏺 全国 {facilitiesData.length} カ所の縄文遺跡を公開中
        </span>
      </div>

      <main className={styles.mainWithBar}>

        {/* ── 1. ヒーローセクション ── */}
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}>縄文時代 — 1万年の記憶</p>
            <h1 className={styles.heroTitle}>
              <ruby>JOMON<rt>ジョウモン</rt></ruby>{" "}<ruby>PORTAL<rt>ポータル</rt></ruby>
            </h1>
            <p className={styles.heroSubtitle}>時を越えて、日本の原風景に出会う</p>
          </div>
        </header>

        {/* ── 2. 今日の1件 ── */}
        {todayFacility && (
          <section className={`${styles.todaySection} container`}>
            <div className={styles.todaySectionHeader}>
              <span className={styles.todayBadge}>NEW</span>
              <h2 className={styles.todaySectionTitle}>今日の1件</h2>
            </div>
            <Link href={`/facility/${todayFacility.id}`} className={styles.todayCard}>
              <div className={styles.todayCardImage}>
                <Image
                  src={getImageUrl(todayFacility)}
                  alt={`${todayFacility.name} のAI生成イメージイラスト`}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className={styles.todayCardImageInner}
                />
                {isVerifiedUrl(todayFacility.url) && (
                  <span className={`${styles.verifiedBadge}${isLgJpUrl(todayFacility.url) ? ` ${styles.verifiedBadgeLg}` : ''}`}>
                    {isLgJpUrl(todayFacility.url) ? '✓ 自治体公式' : '✓ 公式リンク確認済'}
                  </span>
                )}
              </div>
              <div className={styles.todayCardContent}>
                <div className={styles.todayCardTags}>
                  {todayFacility.tags.map(tag => (
                    <span key={tag} className={styles.cardTag}>{tag}</span>
                  ))}
                </div>
                <h3 className={styles.todayCardTitle}>{todayFacility.name}</h3>
                <div className={styles.cardMeta}>
                  <span className={styles.regionTag} style={{ backgroundColor: REGION_COLORS[todayFacility.region] ?? '#666' }}>
                    {REGION_LABELS[todayFacility.region]}
                  </span>
                  <span className={styles.cardPref}>📍 {todayFacility.prefecture}</span>
                </div>
                <p className={styles.todayCardDesc}>
                  {todayFacility.description
                    ? todayFacility.description.substring(0, 120) + "..."
                    : ""}
                </p>
                <span className={styles.todayCardLink}>詳しく見る →</span>
              </div>
            </Link>
          </section>
        )}

        {/* ── 3. 遺跡一覧 ── */}
        <section className={`${styles.section} container`}>
          <h2 className={styles.sectionTitle}>全国の縄文スポット</h2>

          {/* 検索・フィルターUI */}
          <div className={styles.searchBar}>
            <input
              type="text"
              placeholder="名称・説明・都道府県で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <label className={styles.locationLabel}>
              <input type="checkbox" checked={sortByDistance} onChange={handleLocationSort} />
              現在地から近い順
            </label>
          </div>
          <div className={styles.tagChipsWrapper}>
            <div className={styles.tagChips}>
              <button
                className={`${styles.tagChip} ${selectedType === "" ? styles.tagChipActive : ""}`}
                onClick={() => setSelectedType("")}
              >
                すべて
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`${styles.tagChip} ${PRIORITY_TAGS.has(tag) ? styles.tagChipPriority : ""} ${selectedType === tag ? styles.tagChipActive : ""}`}
                  onClick={() => setSelectedType(prev => prev === tag ? "" : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          {locationError && <p className={styles.errorText}>{locationError}</p>}

          {/* 地方タイルナビゲーション */}
          <div className={styles.regionTilesGrid}>
            {Object.entries(REGION_LABELS).map(([key, label]) =>
              regionCounts[key] ? (
                <button
                  key={key}
                  className={`${styles.regionTile} ${selectedRegion === key ? styles.regionTileActive : ""}`}
                  style={selectedRegion === key
                    ? { backgroundColor: REGION_COLORS[key], borderColor: REGION_COLORS[key] }
                    : { borderColor: REGION_COLORS[key] }
                  }
                  onClick={() => setSelectedRegion(prev => prev === key ? "" : key)}
                >
                  <span className={styles.regionTileIcon}>{REGION_ICONS[key]}</span>
                  <span className={styles.regionTileLabel}>{label}</span>
                  <span className={styles.regionTileCount}>{regionCounts[key]}</span>
                </button>
              ) : null
            )}
          </div>

          <p className={styles.resultCount}>
            該当件数: {filteredAndSortedFacilities.length}件 / 全{facilitiesData.length}件
          </p>

          <div className={styles.grid}>
            {displayedFacilities.map((facility, index) => {
              const distance = userLocation
                ? calculateDistance(userLocation.lat, userLocation.lng, facility.lat, facility.lng)
                : null;

              return (
                <div
                  key={facility.id}
                  ref={(el: HTMLDivElement | null) => { cardWrapperRefs.current[index] = el; }}
                  data-card-index={index}
                >
                  <Link href={`/facility/${facility.id}`} className={styles.card}>
                    <div className={styles.cardImageWrapper}>
                      <Image
                        src={getImageUrl(facility)}
                        alt={`${facility.name} のAI生成イメージイラスト`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className={styles.cardImage}
                      />
                      {isVerifiedUrl(facility.url) && (
                        <span className={`${styles.verifiedBadge}${isLgJpUrl(facility.url) ? ` ${styles.verifiedBadgeLg}` : ''}`}>
                          {isLgJpUrl(facility.url) ? '✓ 自治体公式' : '✓ 公式リンク確認済'}
                        </span>
                      )}
                      <span className={styles.aiBadge}>AI</span>
                    </div>
                    <div className={styles.cardContent}>
                      <div>
                        {facility.tags.map(tag => (
                          <span key={tag} className={styles.cardTag}>{tag}</span>
                        ))}
                      </div>
                      <h3 className={styles.cardTitle}>{facility.name}</h3>
                      <div className={styles.cardMeta}>
                        <span className={styles.regionTag} style={{ backgroundColor: REGION_COLORS[facility.region] ?? '#666' }}>
                          {REGION_LABELS[facility.region]}
                        </span>
                        <span className={styles.cardPref}>
                          {facility.prefecture}
                          {distance !== null && ` ・ ${distance.toFixed(1)} km`}
                        </span>
                      </div>
                      <p className={styles.cardText}>
                        {facility.description && facility.description.length > 60
                          ? facility.description.substring(0, 60) + "..."
                          : facility.description || ""}
                      </p>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>

          {visibleCount < filteredAndSortedFacilities.length && (
            <div className={styles.loadMoreContainer}>
              <button
                className={styles.loadMoreBtn}
                onClick={() => setVisibleCount(prev => prev + 20)}
              >
                もっと見る
              </button>
            </div>
          )}
        </section>
      </main>

      {/* フローティングカウンター */}
      {showFloating && (
        <div className={styles.floatingCounter}>
          全 {filteredAndSortedFacilities.length} 件中{" "}
          <strong>{firstVisibleIndex + 1}</strong> 番目付近を表示中
        </div>
      )}
    </>
  );
}
