"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useMemo } from "react";
import styles from "./page.module.css";
import facilitiesData from "./data/facilities.json";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);

  // 全てのタグを取得して重複排除
  const allTags = Array.from(new Set(facilitiesData.flatMap(f => f.tags)));

  // 距離計算（ハバシン公式）
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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
          (error) => {
            console.error("Error getting location: ", error);
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
      // フリーワード検索
      const matchQuery =
        facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (facility.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        facility.prefecture.includes(searchQuery);

      // タグフィルタ
      const matchType = selectedType === "" || facility.tags.includes(selectedType);

      return matchQuery && matchType;
    });

    // 距離でソート
    if (sortByDistance && userLocation) {
      result.sort((a, b) => {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
        return distA - distB;
      });
    }

    return result;
  }, [searchQuery, selectedType, sortByDistance, userLocation]);

  // AI画像のURL生成
  const getImageUrl = (facility: any) => {
    if (facility.thumbnail) return facility.thumbnail;
    const prompt = encodeURIComponent(`Jomon period archaeological site, ${facility.id.replace(/-/g, ' ')}, photorealistic, cinematic lighting, ancient Japan landscape, highly detailed nature`);
    return `https://image.pollinations.ai/prompt/${prompt}?width=600&height=400&nologo=true`;
  };

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
            <input
              type="checkbox"
              checked={sortByDistance}
              onChange={handleLocationSort}
            />
            現在地から近い順
          </label>
        </div>
        {locationError && <p className={styles.errorText}>{locationError}</p>}

        <p className={styles.resultCount}>該当件数: {filteredAndSortedFacilities.length}件 / 全{facilitiesData.length}件</p>

        <div className={styles.grid}>
          {filteredAndSortedFacilities.map((facility) => {
            const distance = userLocation
              ? calculateDistance(userLocation.lat, userLocation.lng, facility.lat, facility.lng)
              : null;

            return (
              <Link href={`/facility/${facility.id}`} key={facility.id} className={styles.card}>
                <div className={styles.cardImageWrapper}>
                  <Image
                    src={getImageUrl(facility)}
                    alt={facility.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className={styles.cardImage}
                  />
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
            );
          }).slice(0, visibleCount)}
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
  );
}
