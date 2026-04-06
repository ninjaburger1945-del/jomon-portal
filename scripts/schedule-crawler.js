#!/usr/bin/env node

/**
 * クローラーのスケジューリング設定スクリプト
 *
 * 自動実行を設定する場合、このスクリプトで cron スケジュール管理可能
 * または Windows タスクスケジューラで定期実行
 */

const fs = require('fs');
const path = require('path');

const scheduleConfig = {
  name: 'jomon-portal-daily-crawler',
  description: 'Daily Jomon facility crawler with Google Custom Search API',
  version: '1.0.0',

  // スケジュール設定
  schedule: {
    // 【推奨】毎日午前9時（UTC+9）
    cron: '0 9 * * *',
    timezone: 'Asia/Tokyo',

    // または定期間隔で実行（推奨：毎日1回）
    interval: '24h'  // 24時間ごと
  },

  // 実行設定
  execution: {
    command: 'node scripts/daily-crawler.js',
    workingDirectory: process.cwd(),

    // タイムアウト設定（最大30分）
    timeout: 30 * 60 * 1000,

    // リトライ設定
    retry: {
      attempts: 3,
      delayMs: 5000
    }
  },

  // ログ設定
  logging: {
    enabled: true,
    directory: path.join(process.cwd(), 'logs'),
    format: 'json', // or 'text'
    retention: {
      days: 30
    }
  },

  // 監視設定
  monitoring: {
    // 失敗時の通知
    notifyOnFailure: false,
    // notificationChannels: ['email', 'slack'],

    // 成功時のメトリクス記録
    recordMetrics: true
  }
};

// ログディレクトリを作成
const logsDir = scheduleConfig.logging.directory;
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log(`[SETUP] ログディレクトリを作成: ${logsDir}`);
}

// 設定をファイルに保存
const configPath = path.join(process.cwd(), '.crawler-schedule.json');
fs.writeFileSync(configPath, JSON.stringify(scheduleConfig, null, 2));
console.log(`[SETUP] スケジュール設定を保存: ${configPath}`);

// 次の実行予定時刻を計算
const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
tomorrow.setHours(9, 0, 0, 0);

console.log('\n' + '='.repeat(60));
console.log('クローラーのスケジューリング設定完了');
console.log('='.repeat(60));
console.log(`\n次の実行予定: ${tomorrow.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
console.log(`\n【設定方法】\n`);
console.log(`📌 Linux/Mac (cron):`);
console.log(`   0 9 * * * cd ${process.cwd()} && node scripts/daily-crawler.js >> logs/crawler.log 2>&1\n`);
console.log(`📌 Windows (タスクスケジューラ):`);
console.log(`   プログラム: node.exe`);
console.log(`   引数: scripts/daily-crawler.js`);
console.log(`   作業ディレクトリ: ${process.cwd()}\n`);
console.log(`📌 Docker (自動実行コンテナ):`);
console.log(`   # cron パッケージをインストールして定期実行`);
console.log(`   RUN echo "0 9 * * * cd /app && node scripts/daily-crawler.js" | crontab -\n`);

console.log(`✅ 設定ファイル: ${configPath}`);
console.log(`✅ ログディレクトリ: ${logsDir}\n`);
