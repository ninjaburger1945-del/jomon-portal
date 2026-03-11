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
          AIコンテンツについて
        </button>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>AI活用ポリシー</h2>
            <div className={styles.modalBody}>
              <p>
                当サイトでは、各遺跡や博物館の魅力を直感的に伝えるため、一部の画像生成にAIを活用しています。
                これらは実際の写真ではなく、「縄文の記憶」を元にイメージを補完し、当時の空気感や想像を膨らませるための演出として提供されているものです。
              </p>
              <p>
                正確な実物の姿や発掘状況については、各施設の公式サイトをご参照ください。
              </p>
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
