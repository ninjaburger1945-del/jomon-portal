"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useEffect, useRef } from "react";
import styles from "./page.module.css";
import facilitiesData from "./data/facilities.json";

const REGION_LABELS: Record<string, string> = {
  "Hokkaido-Tohoku": "北海道・東北",
  "Kanto": "関東",
  "Chubu": "中部",
  "Chugoku": "中国",
  "Shikoku": "四国",
  "Kyushu": "九州",
};

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

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);
  const [showFloating, setShowFloating] = useState(false);

  const cardWrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleIndicesRef = useRef(new Set<number>());

  const allTags = Array.from(new Set(facilitiesData.flatMap(f => f.tags)));

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    facilitiesData.forEach(f => { counts[f.region] = (counts[f.region] || 0) + 1; });
    return counts;
  }, []);

  // 3件以上の都道府県を件数降順で表示
  const topPrefectures = useMemo(() => {
    const counts: Record<string, number> = {};
    facilitiesData.forEach(f => { counts[f.prefecture] = (counts[f.prefecture] || 0) + 1; });
    return Object.entries(counts)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]);
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

  const handleRegionChip = (region: string) => {
    setSelectedRegion(prev => prev === region ? "" : region);
    setSelectedPrefecture("");
  };

  const handlePrefectureChip = (prefecture: string) => {
    setSelectedPrefecture(prev => prev === prefecture ? "" : prefecture);
    setSelectedRegion("");
  };

  const filteredAndSortedFacilities = useMemo(() => {
    let result = facilitiesData.filter(facility => {
      const matchQuery =
        facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (facility.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        facility.prefecture.includes(searchQuery);
      const matchType = selectedType === "" || facility.tags.includes(selectedType);
      const matchRegion = selectedRegion === "" || facility.region === selectedRegion;
      const matchPrefecture = selectedPrefecture === "" || facility.prefecture === selectedPrefecture;
      return matchQuery && matchType && matchRegion && matchPrefecture;
    });

    if (sortByDistance && userLocation) {
      result.sort((a, b) =>
        calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
      );
    }
    return result;
  }, [searchQuery, selectedType, selectedRegion, selectedPrefecture, sortByDistance, userLocation]);

  // フィルター変更時に表示件数をリセット
  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, selectedType, selectedRegion, selectedPrefecture]);

  // IntersectionObserver でフローティングカウンター用の先頭インデックスを追跡
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

  // ヒーロー通過後にフローティングカウンターを表示
  useEffect(() => {
    const onScroll = () => setShowFloating(window.scrollY > 400);
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
      {/* 1. 全国縄文パトロール Sticky bar */}
      <div className={styles.stickyBar}>
        <span className={styles.stickyBarText}>
          🏺 全国 180カ所以上の縄文遺跡を公開中
        </span>
        <span className={styles.stickyBarCount}>
          現在 <strong>{filteredAndSortedFacilities.length}</strong> 件を表示
        </span>
      </div>

      <main className={styles.mainWithBar}>
        <header className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>JOMON PORTAL</h1>
            <p className={styles.heroSubtitle}>時を越えて、日本の原風景に出会う</p>
          </div>
        </header>

        <section className={`${styles.section} container`}>
          <h2 className={styles.sectionTitle}>注目の縄文スポット</h2>

          {/* 検索・フィルターUI */}
          <div className={styles.searchBar}>
            <input
              type="text"
              placeholder="名称・説明・都道府県で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className={styles.searchSelect}
            >
              <option value="">すべての施設・種別</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
            <label className={styles.locationLabel}>
              <input type="checkbox" checked={sortByDistance} onChange={handleLocationSort} />
              現在地から近い順
            </label>
          </div>
          {locationError && <p className={styles.errorText}>{locationError}</p>}

          {/* 2. 地方・都道府県別クイックフィルター */}
          <div className={styles.quickFilterRow}>
            {Object.entries(REGION_LABELS).map(([key, label]) =>
              regionCounts[key] ? (
                <button
                  key={key}
                  className={`${styles.quickFilterChip} ${selectedRegion === key ? styles.chipActive : ""}`}
                  onClick={() => handleRegionChip(key)}
                >
                  {label} <span className={styles.chipCount}>{regionCounts[key]}</span>
                </button>
              ) : null
            )}
            {topPrefectures.map(([pref, count]) => (
              <button
                key={pref}
                className={`${styles.quickFilterChip} ${styles.quickFilterChipPref} ${selectedPrefecture === pref ? styles.chipActivePref : ""}`}
                onClick={() => handlePrefectureChip(pref)}
              >
                {pref.replace(/[都道府県]$/, "")} <span className={styles.chipCount}>{count}</span>
              </button>
            ))}
            {(selectedRegion || selectedPrefecture) && (
              <button
                className={styles.quickFilterReset}
                onClick={() => { setSelectedRegion(""); setSelectedPrefecture(""); }}
              >
                ✕ クリア
              </button>
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
                        alt={facility.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className={styles.cardImage}
                      />
                      {/* 4. 公式リンク確認済バッジ */}
                      {isVerifiedUrl(facility.url) && (
                        <span className={styles.verifiedBadge}>✓ 公式リンク確認済</span>
                      )}
                    </div>
                    <p className={styles.aiAnnotation}>
                      ※このイラストは遺跡の情報を元にAIで生成されたイメージ図です。
                    </p>
                    <div className={styles.cardContent}>
                      <div>
                        {facility.tags.map(tag => (
                          <span key={tag} className={styles.cardTag}>{tag}</span>
                        ))}
                      </div>
                      <h3 className={styles.cardTitle}>{facility.name}</h3>
                      <span className={styles.cardRegion}>
                        {facility.prefecture}
                        {distance !== null && ` (${distance.toFixed(1)} km)`}
                      </span>
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

      {/* 3. ダイナミック・フローティングカウンター */}
      {showFloating && (
        <div className={styles.floatingCounter}>
          全 {filteredAndSortedFacilities.length} 件中{" "}
          <strong>{firstVisibleIndex + 1}</strong> 番目付近を表示中
        </div>
      )}
    </>
  );
}
