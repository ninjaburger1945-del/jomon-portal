"use client";

import { useState } from "react";
import styles from "./Footer.module.css";

export default function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p className={styles.copyright}>&copy; 2026 JOMON PORTAL All rights reserved.</p>
        <button className={styles.aiPolicyLink} onClick={() => setIsModalOpen(true)}>
          このサイトについて
        </button>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>このサイトについて</h2>
            <div className={styles.modalBody}>
              <p>
                Jomon Portal（縄文ポータル）は、日本全国に点在する縄文遺跡の魅力を網羅することを目指したサイトです。
              </p>

              <section>
                <h3 className={styles.modalSectionTitle}>AIによる日々の更新</h3>
                <p>
                  本サイトではAIを活用し、全国の新しい遺跡情報を毎日1件ずつ追加しています。最新のテクノロジーを用いることで、これまで埋もれていた各地の魅力的な史跡を掘り起こし、お届けします。
                </p>
              </section>

              <section>
                <h3 className={styles.modalSectionTitle}>旅のパートナーとして</h3>
                <p>
                  各遺跡の紹介には、自治体等の公式リンクや正確なアクセス方法を記載することにこだわっています。データの正確性を追求することで、皆さんの「縄文への旅」に実務的にお役立ていただけるポータルサイトを目指しています。ぜひ、現地を訪れる際の計画にお役立てください。
                </p>
              </section>

              <section>
                <h3 className={styles.modalSectionTitle}>AIイラストについて</h3>
                <p>
                  本サイトで使用しているイラストは、AIを用いて生成されています。当時の風景や集落の空気感を現代の感性で再解釈したイメージ図です。考古学的な事実に、AIが描く自由なイマジネーションを掛け合わせることで、縄文時代のロマンをより身近に感じていただければ幸いです。
                </p>
              </section>
            </div>
            <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}
