#!/usr/bin/env node

/**
 * clean-tags.js
 * 既存施設（1-64番）から不正なタグを削除し、許可リストのみを保持
 * 65番以降は自動抽出ロジックに任せるため触らない
 */

const fs = require('fs');
const path = require('path');

// ========== 許可されたタグリスト（ホワイトリスト） ==========
const ALLOWED_TAGS = [
  '世界遺産',
  '博物館',
  '国宝',
  '土偶',
  '貝塚',
  '土器',
  '環状列石'
];

// ========== ファイルパス ==========
const filePath = path.join(__dirname, '../app/data/facilities.json');

// ========== タグクリーニング関数 ==========
function cleanTags(facilities) {
  let cleanedCount = 0;
  let changedCount = 0;

  facilities.forEach((facility, index) => {
    const facilityNum = index + 1;

    // 65施設目以降は処理スキップ
    if (facilityNum >= 65) {
      console.log(`[SKIP] ID ${String(facilityNum).padStart(3, '0')}: 65番以降のため処理スキップ`);
      return;
    }

    if (!facility.tags || !Array.isArray(facility.tags)) {
      return;
    }

    // 元のタグ
    const originalTags = [...facility.tags];

    // 許可リストに含まれるタグのみを保持
    facility.tags = facility.tags.filter(tag => ALLOWED_TAGS.includes(tag));

    // 変更があったか確認
    if (originalTags.length !== facility.tags.length) {
      const removedTags = originalTags.filter(tag => !facility.tags.includes(tag));
      console.log(`[CLEANED] ID ${String(facilityNum).padStart(3, '0')} - ${facility.name}`);
      console.log(`  削除: ${removedTags.join(', ')}`);
      console.log(`  確定: [${facility.tags.join(', ') || 'なし'}]`);
      changedCount++;
    } else {
      console.log(`[OK] ID ${String(facilityNum).padStart(3, '0')} - ${facility.name} (変更なし)`);
    }

    cleanedCount++;
  });

  return { cleanedCount, changedCount };
}

// ========== メイン処理 ==========
(async () => {
  try {
    console.log(`\n[CLEAN-TAGS] ========== タグクリーニング開始 ==========\n`);

    // ファイル読み込み
    if (!fs.existsSync(filePath)) {
      console.error(`[ERROR] facilities.json が見つかりません: ${filePath}`);
      process.exit(1);
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const facilities = JSON.parse(rawData);

    console.log(`[INIT] 施設数: ${facilities.length} 件`);
    console.log(`[INIT] 許可タグ: [${ALLOWED_TAGS.join(', ')}]\n`);

    // タグクリーニング実行
    const { cleanedCount, changedCount } = cleanTags(facilities);

    console.log(`\n[RESULT] ========== クリーニング完了 ==========`);
    console.log(`[RESULT] チェック対象: ${cleanedCount} 件（1-64番）`);
    console.log(`[RESULT] 変更施設: ${changedCount} 件`);
    console.log(`[RESULT] スキップ対象: ${facilities.length - cleanedCount} 件（65番以降）\n`);

    if (changedCount > 0) {
      // ファイル保存
      fs.writeFileSync(filePath, JSON.stringify(facilities, null, 2), 'utf-8');
      console.log(`[SUCCESS] ✅ facilities.json を更新・保存しました`);
      console.log(`[SUCCESS] ファイルサイズ: ${fs.statSync(filePath).size} bytes\n`);
      process.exit(0);
    } else {
      console.log(`[INFO] ℹ️ 変更施設がないため、ファイル保存はスキップしました\n`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`[ERROR] クリーニング処理エラー: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
})();
