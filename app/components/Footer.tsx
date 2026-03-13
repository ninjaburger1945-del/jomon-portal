"use client";

import { useState } from "react";
import styles from "./Footer.module.css";

export default function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p className={styles.copyright}>&copy; 2026 JOMON PORTAL All rights reserved.</p>
        <button className={styles.aiPolicyLink} onClick={() => { setIsExpanded(false); setIsModalOpen(true); }}>
          このサイトについて
        </button>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>このサイトについて</h2>
              <button className={styles.closeXBtn} onClick={() => setIsModalOpen(false)} aria-label="閉じる">✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalSummary}>
                Jomon Portalは、全国の縄文遺跡を網羅したポータルサイトです。AIが毎日1件ずつ情報を更新し、公式サイトへの正確なリンクと、遺跡ごとのAI生成イラストで当時の空気感をお届けします。
              </p>

              {isExpanded && (
                <div className={styles.accordionBody}>
                  <section>
                    <h3 className={styles.modalSectionTitle}>AIによる日々の更新</h3>
                    <p>AIを活用し、全国の縄文遺跡情報を毎日1件ずつ追加しています。これまで埋もれていた各地の史跡を掘り起こし、旅の候補地としてお届けします。</p>
                  </section>
                  <section>
                    <h3 className={styles.modalSectionTitle}>公式リンクへのこだわり</h3>
                    <p>自治体等の公式サイトへの正確なリンクとアクセス情報を掲載し、現地訪問の計画に役立てていただけるよう努めています。</p>
                  </section>
                  <section>
                    <h3 className={styles.modalSectionTitle}>AIイラストについて</h3>
                    <p>サイト内のイラストはAI生成です。考古学的事実をもとに当時の空気感を再解釈したイメージ図としてご利用ください。</p>
                  </section>
                </div>
              )}

              <button
                className={styles.accordionToggle}
                onClick={() => setIsExpanded(prev => !prev)}
              >
                {isExpanded ? "▲ 閉じる" : "▼ 詳細を読む"}
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
