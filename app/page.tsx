"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useEffect, useRef } from "react";
import styles from "./page.module.css";
import facilitiesData from "./data/facilities.json";

interface JomonEvent {
  id: string;
  title: string;
  date_start: string;
  date_end?: string;
  time?: string;
  location?: string;
  facility_name?: string;
  prefecture?: string;
  region?: string;
  url?: string;
  category?: string;
  description?: string;
}

const REGION_LABELS: Record<string, string> = {
  "Hokkaido": "北海道",
  "Tohoku":   "東北",
  "Kanto":    "関東",
  "Chubu":    "中部",
  "Kinki":    "近畿",
  "ChugokuShikoku": "中国・四国",
  "KyushuOkinawa":  "九州・沖縄",
};

const REGION_COLORS: Record<string, string> = {
  "Hokkaido": "#1A5276",
  "Tohoku":   "#2E6B35",
  "Kanto":    "#1B6FA8",
  "Chubu":    "#7A5C1E",
  "Kinki":    "#6B3A6E",
  "ChugokuShikoku": "#1A7070",
  "KyushuOkinawa":  "#9B2B2B",
};

const REGION_ICONS: Record<string, string> = {
  "Hokkaido": "❄️",
  "Tohoku":   "🌲",
  "Kanto":    "🏺",
  "Chubu":    "⛰️",
  "Kinki":    "🌿",
  "ChugokuShikoku": "🌊",
  "KyushuOkinawa":  "🌋",
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
  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);
  const [showFloating, setShowFloating] = useState(false);
  const [upcomingEventCount, setUpcomingEventCount] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<JomonEvent[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  const cardWrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleIndicesRef = useRef(new Set<number>());

  // URLパラメータ（?region= / ?pref=）からフィルター初期化
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const region = params.get("region");
    const pref = params.get("pref");
    if (region && Object.keys(REGION_LABELS).includes(region)) setSelectedRegion(region);
    if (pref) setSelectedPrefecture(pref);
  }, []);

  // イベント情報を取得し、直近イベントをカルーセルに反映
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/events', { cache: 'no-store' });
        const events: JomonEvent[] = await res.json();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

        // 現在開催中 or これから30日以内に開催予定のイベント
        const activeAndUpcoming = events.filter((e) => {
          const startDate = new Date(e.date_start);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(e.date_end || e.date_start);
          endDate.setHours(23, 59, 59, 999);

          // 開催中：startDate ≤ 今日 ≤ endDate
          const isActive = startDate <= today && endDate >= today;
          // 直近30日以内：startDate が今日から30日以内
          const isUpcoming = startDate > today && startDate <= thirtyDaysLater;

          return isActive || isUpcoming;
        });

        // 開催日が近い順にソート
        activeAndUpcoming.sort((a, b) =>
          new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
        );

        setUpcomingEventCount(activeAndUpcoming.length);
        setUpcomingEvents(activeAndUpcoming.slice(0, 5)); // 直近5件
        setCurrentEventIndex(0);
      } catch (error) {
        console.error('[fetch events]', error);
      }
    };
    fetchEvents();
  }, []);

  const newestFacilityId = facilitiesData[facilitiesData.length - 1]?.id;

  // 最新施設の地方を取得（New! バッジ用：1つの地域のみ）
  const newestRegion = (() => {
    const latest = facilitiesData[facilitiesData.length - 1];
    if (!latest) return null;
    if (latest.region === "Chugoku" || latest.region === "Shikoku") return "ChugokuShikoku";
    if (latest.region === "Kyushu" || latest.region === "Okinawa") return "KyushuOkinawa";
    return latest.region;
  })();
  const allTags = Array.from(new Set(facilitiesData.flatMap(f => f.tags)));

  // Count facilities by region
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    facilitiesData.forEach(f => {
      let mappedRegion = f.region;
      if (f.region === "Chugoku" || f.region === "Shikoku") {
        mappedRegion = "ChugokuShikoku";
      } else if (f.region === "Kyushu" || f.region === "Okinawa") {
        mappedRegion = "KyushuOkinawa";
      }
      counts[mappedRegion] = (counts[mappedRegion] || 0) + 1;
    });
    // DEBUG: region counts confirmation
    console.log('[regionCounts]', counts);
    console.log('[REGION_LABELS keys]', Object.keys(REGION_LABELS));
    console.log('[ChugokuShikoku count]', counts["ChugokuShikoku"]);
    console.log('[KyushuOkinawa count]', counts["KyushuOkinawa"]);
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
      const matchRegion = (() => {
        if (selectedRegion === "") return true;
        if (selectedRegion === "ChugokuShikoku") {
          return facility.region === "Chugoku" || facility.region === "Shikoku";
        }
        if (selectedRegion === "KyushuOkinawa") {
          return facility.region === "Kyushu" || facility.region === "Okinawa";
        }
        return facility.region === selectedRegion;
      })();
      const matchPref = selectedPrefecture === "" || facility.prefecture === selectedPrefecture;
      return matchQuery && matchType && matchRegion && matchPref;
    });

    if (sortByDistance && userLocation) {
      result.sort((a, b) =>
        calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
      );
    } else {
      result = [...result].reverse();
    }
    return result;
  }, [searchQuery, selectedType, selectedRegion, selectedPrefecture, sortByDistance, userLocation]);

  useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, selectedType, selectedRegion, selectedPrefecture]);

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

  // Helper function: Map raw region to display region
  const mapRegionToDisplay = (rawRegion: string): string => {
    if (rawRegion === "Chugoku" || rawRegion === "Shikoku") {
      return "ChugokuShikoku";
    }
    if (rawRegion === "Kyushu" || rawRegion === "Okinawa") {
      return "KyushuOkinawa";
    }
    return rawRegion;
  };

  // イベントカルーセル自動ローテーション
  useEffect(() => {
    if (upcomingEvents.length === 0) return;

    const interval = setInterval(() => {
      setCurrentEventIndex((prev) => (prev + 1) % upcomingEvents.length);
    }, 3000); // 3秒ごと

    return () => clearInterval(interval);
  }, [upcomingEvents.length]);

  // ヒーロー背景画像スライドショー（5秒ごと）
  useEffect(() => {
    if (facilitiesData.length === 0) return;

    const interval = setInterval(() => {
      setHeroImageIndex((prev) => (prev + 1) % Math.min(facilitiesData.length, 10));
    }, 5000); // 5秒ごと

    return () => clearInterval(interval);
  }, []);

  const displayedFacilities = filteredAndSortedFacilities.slice(0, visibleCount);
  const currentEvent = upcomingEvents[currentEventIndex];

  return (
    <>
      <main className={styles.mainWithBar}>

        {/* ── 1. ヒーローセクション（画像スライドショー） ── */}
        <header
          className={styles.hero}
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.45) 100%), url('${getImageUrl(facilitiesData[heroImageIndex % facilitiesData.length])}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            transition: 'background-image 0.8s ease-in-out',
          }}
        >
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Jomon Portal
            </h1>
            <p className={styles.heroSubtitle}>10,000 Years of Survival</p>
          </div>
        </header>

        {/* ── 1.5 直近イベントバナー（カルーセル） ── */}
        {upcomingEventCount > 0 && currentEvent && (
          <div style={{
            background: 'linear-gradient(135deg, #3D2817 0%, #2B1F12 100%)',
            color: 'white',
            padding: '24px',
            margin: '20px auto',
            maxWidth: '900px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(61, 40, 23, 0.5)',
            transition: 'all 0.3s ease',
          }}>
            {/* イベント詳細 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', opacity: 0.85, marginBottom: '8px' }}>
                🔥 直近イベント（{currentEventIndex + 1} / {upcomingEvents.length}件表示中）
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '8px 0', lineHeight: 1.3 }}>
                {currentEvent.title}
              </h3>
              <div style={{ fontSize: '14px', opacity: 0.9, marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>📅 <strong>{currentEvent.date_start}</strong>
                  {currentEvent.date_end && currentEvent.date_end !== currentEvent.date_start && ` ～ ${currentEvent.date_end}`}
                </div>
                {currentEvent.time && <div>⏰ {currentEvent.time}</div>}
                {currentEvent.location && <div>📍 {currentEvent.prefecture} / {currentEvent.location}</div>}
                {!currentEvent.location && currentEvent.prefecture && <div>📍 {currentEvent.prefecture}</div>}
                {currentEvent.facility_name && <div>🏛️ {currentEvent.facility_name}</div>}
              </div>
            </div>

            {/* ナビゲーションドット + リンク */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}>
              {/* ナビゲーションドット */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {upcomingEvents.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentEventIndex(idx)}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: idx === currentEventIndex ? 'white' : 'rgba(255, 255, 255, 0.4)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    aria-label={`Event ${idx + 1}`}
                  />
                ))}
              </div>

              {/* イベント一覧リンク */}
              <Link
                href="/events"
                style={{
                  backgroundColor: 'white',
                  color: '#B8401A',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  display: 'inline-block',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                詳しく見る →
              </Link>
            </div>
          </div>
        )}

        {/* ── 2. 遺跡一覧 ── */}
        <section className={`${styles.section} container`}>
          <h2 className={styles.sectionTitle}>全国 {facilitiesData.length} カ所の縄文遺跡を公開中</h2>

          {/* 地方タイルナビゲーション */}
          <div className={styles.regionTilesGrid}>
            <div className={styles.regionTilesInner}>
              {/* 全国タイル */}
              <button
                className={`${styles.regionTile} ${selectedRegion === "" ? styles.regionTileActive : ""}`}
                style={selectedRegion === ""
                  ? { backgroundColor: "#1C150A", borderColor: "#1C150A" }
                  : { borderColor: "#1C150A", color: "#1C150A" }
                }
                onClick={() => {
                  setSelectedRegion("");
                  const params = new URLSearchParams(window.location.search);
                  params.delete("region");
                  const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
                  window.history.replaceState({}, "", newUrl);
                }}
              >
                <span className={styles.regionTileIcon}>🔴</span>
                <span className={styles.regionTileLabel}>全国</span>
                <span className={styles.regionTileCount}>{facilitiesData.length}</span>
              </button>

              {/* 地方タイル */}
              {Object.entries(REGION_LABELS).map(([key, label]) =>
                regionCounts[key] ? (
                  <button
                    key={key}
                    className={`${styles.regionTile} ${selectedRegion === key ? styles.regionTileActive : ""}`}
                    style={selectedRegion === key
                      ? { backgroundColor: REGION_COLORS[key], borderColor: REGION_COLORS[key], position: 'relative' }
                      : { borderColor: REGION_COLORS[key], color: REGION_COLORS[key], position: 'relative' }
                    }
                    onClick={() => {
                      const next = selectedRegion === key ? "" : key;
                      setSelectedRegion(next);
                      const params = new URLSearchParams(window.location.search);
                      if (next) params.set("region", next);
                      else params.delete("region");
                      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
                      window.history.replaceState({}, "", newUrl);
                    }}
                  >
                    <span className={styles.regionTileIcon}>{REGION_ICONS[key]}</span>
                    <span className={styles.regionTileLabel}>{label}</span>
                    <span className={styles.regionTileCount}>{regionCounts[key]}</span>
                    {newestRegion === key && (
                      <span style={{
                        position: 'absolute',
                        top: '2px',
                        right: '4px',
                        backgroundColor: '#FF4444',
                        color: 'white',
                        fontSize: '0.6rem',
                        fontWeight: '800',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        animation: 'pulse 2s ease-in-out infinite',
                        whiteSpace: 'nowrap',
                        zIndex: 10,
                      }}>
                        NEW
                      </span>
                    )}
                  </button>
                ) : null
              )}
            </div>
          </div>

          {/* タグ・検索・フィルターUI */}
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
          {locationError && <p className={styles.errorText}>{locationError}</p>}

          {selectedPrefecture && (
            <div className={styles.prefFilterChip}>
              <span>{selectedPrefecture}で絞り込み中</span>
              <button
                className={styles.prefFilterClear}
                onClick={() => {
                  setSelectedPrefecture("");
                  const params = new URLSearchParams(window.location.search);
                  params.delete("pref");
                  const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
                  window.history.replaceState({}, "", newUrl);
                }}
                aria-label="都道府県フィルターを解除"
              >×</button>
            </div>
          )}

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
                      {facility.id === newestFacilityId && (
                        <span className={styles.newBadge}>NEW</span>
                      )}
                      <span className={styles.aiBadge}>AI Image</span>
                    </div>
                    <div className={styles.cardContent}>
                      <div className={styles.cardMeta}>
                        <span className={styles.regionTag} style={{ backgroundColor: REGION_COLORS[mapRegionToDisplay(facility.region)] ?? '#666' }}>
                          {REGION_LABELS[mapRegionToDisplay(facility.region)]}
                        </span>
                        <span className={styles.cardPref}>
                          {facility.prefecture}
                          {distance !== null && ` ・ ${distance.toFixed(1)} km`}
                        </span>
                        {facility.tags.slice(0, 2).map(tag => (
                          <span key={tag} className={styles.cardTag}>{tag}</span>
                        ))}
                      </div>
                      <h3 className={styles.cardTitle}>{facility.name}</h3>
                      {(facility as { copy?: string }).copy && (
                        <p className={styles.cardText}>{((facility as { copy?: string }).copy ?? "").slice(0, 14)}</p>
                      )}
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
