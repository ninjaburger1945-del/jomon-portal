#!/bin/bash

##############################################################################
# Jomon Portal - ConoHa Auto Setup Script
#
# 使用方法:
#   bash scripts/setup-conoha.sh
#
# このスクリプトは以下を実行します:
#   1. Node.js & PM2 セットアップ
#   2. ログディレクトリ作成
#   3. ecosystem.config.js の設定確認
#   4. PM2 スタートアップ設定
#   5. Cron ジョブ設定
##############################################################################

set -e

echo "🏺 ========== Jomon Portal ConoHa セットアップ =========="

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ロギング関数
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# ============= 1. Node.js & PM2 確認 =============
log_info "Node.js & PM2 をチェック中..."

if ! command -v node &> /dev/null; then
  log_error "Node.js がインストールされていません。先に Node.js をインストールしてください。"
  exit 1
fi

NODE_VERSION=$(node -v)
log_info "Node.js バージョン: $NODE_VERSION"

if ! command -v pm2 &> /dev/null; then
  log_info "PM2 をグローバルインストール中..."
  npm install -g pm2
else
  PM2_VERSION=$(pm2 -v)
  log_info "PM2 バージョン: $PM2_VERSION"
fi

# ============= 2. ログディレクトリ作成 =============
log_info "ログディレクトリを作成中..."

if [ ! -d "logs" ]; then
  mkdir -p logs
  log_info "ディレクトリ作成: logs/"
else
  log_info "ディレクトリ既存: logs/"
fi

# ============= 3. 依存関係インストール =============
log_info "npm 依存関係をインストール中..."
npm install --legacy-peer-deps

# ============= 4. 環境変数ファイル確認 =============
log_info ".env.local ファイルをチェック中..."

if [ ! -f ".env.local" ]; then
  log_warn ".env.local が見つかりません！"
  echo ""
  echo "以下の環境変数を設定してください:"
  echo "  GOOGLE_GENERATIVE_AI_API_KEY"
  echo "  GEMINI_API_KEY20261336"
  echo "  GOOGLE_CUSTOM_SEARCH_API_KEY"
  echo "  GOOGLE_CUSTOM_SEARCH_ENGINE_ID"
  echo "  GITHUB_TOKEN"
  echo ""
  read -p ".env.local の作成をスキップしますか? (y/N): " skip_env
  if [ "$skip_env" != "y" ]; then
    cat > .env.local << 'EOF'
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
GEMINI_API_KEY20261336=your_key_here
GOOGLE_CUSTOM_SEARCH_API_KEY=your_key_here
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_id_here
GITHUB_TOKEN=your_token_here
EOF
    log_info ".env.local を作成しました。値を編集してください。"
  fi
else
  log_info ".env.local が存在します。"
fi

# ============= 5. ecosystem.config.js 確認 =============
log_info "ecosystem.config.js をチェック中..."

if [ ! -f "ecosystem.config.js" ]; then
  log_error "ecosystem.config.js が見つかりません！"
  exit 1
fi

log_info "ecosystem.config.js が確認できました。"

# ============= 6. PM2 スタートアップ設定 =============
log_info "PM2 スタートアップ設定を構成中..."

# 環境変数をロード
export $(cat .env.local | grep -v '^#' | xargs)

# PM2 スタートアップスクリプト生成
pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))

# PM2 プロセス起動
log_info "PM2 で Jomon Portal を起動中..."
pm2 start ecosystem.config.js

# PM2 設定を保存
pm2 save

log_info "PM2 プロセスの状態:"
pm2 status

# ============= 7. Cron ジョブ設定 =============
log_info "Cron ジョブを設定中..."

CRON_FILE="/tmp/jomon_cron.tmp"

cat > $CRON_FILE << 'EOF'
# ===== JOMON PORTAL AUTOMATION =====

# デイリークローラー（毎日 AM 2:00 JST）
0 2 * * * cd ~/jomon-portal && node scripts/daily-crawler.js >> ~/jomon-portal/logs/crawler.log 2>&1

# データ整形リマスター（毎日 AM 3:00 JST）
0 3 * * * cd ~/jomon-portal && node scripts/refine-facilities.js >> ~/jomon-portal/logs/refine.log 2>&1

# イラスト再生成リマスター（毎週土曜 AM 3:30 JST）
30 3 * * 6 cd ~/jomon-portal && node scripts/regenerate-images.js >> ~/jomon-portal/logs/regenerate-images.log 2>&1

# 欠落イラスト生成（毎週土曜 AM 4:00 JST）
0 4 * * 6 cd ~/jomon-portal && node scripts/generate-missing-images.js >> ~/jomon-portal/logs/generate-missing.log 2>&1

# イベントコレクト（毎週日曜 AM 4:30 JST）
30 4 * * 0 cd ~/jomon-portal && node scripts/collect-events.js >> ~/jomon-portal/logs/events.log 2>&1

# Weekly全体チェック＆ビルド（毎週月曜 AM 5:00 JST）
0 5 * * 1 cd ~/jomon-portal && npm run build >> ~/jomon-portal/logs/build.log 2>&1
EOF

# 既存の crontab と新しい設定をマージ
if crontab -l 2>/dev/null | grep -q "JOMON PORTAL AUTOMATION"; then
  log_warn "Cron ジョブはすでに設定されています。スキップします。"
else
  (crontab -l 2>/dev/null || true; cat $CRON_FILE) | crontab -
  log_info "Cron ジョブを設定しました。"
fi

rm -f $CRON_FILE

# ============= 8. セットアップ完了 =============
echo ""
echo -e "${GREEN}========== セットアップ完了 ==========${NC}"
echo ""
echo "✅ Node.js インストール確認"
echo "✅ PM2 インストール完了"
echo "✅ ログディレクトリ作成"
echo "✅ PM2 プロセス起動"
echo "✅ Cron ジョブ設定"
echo ""
echo "次のステップ:"
echo "1. .env.local に API キーを設定してください"
echo "2. GitHub Secrets を設定してください（README.md 参照）"
echo "3. ログを確認: pm2 logs"
echo "4. ステータス確認: pm2 status"
echo ""
echo "🏺 Jomon Portal の自動化セットアップが完了しました！"
