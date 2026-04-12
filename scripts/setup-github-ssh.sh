#!/bin/bash

##############################################################################
# Jomon Portal - GitHub Actions SSH Setup
#
# 使用方法:
#   bash scripts/setup-github-ssh.sh
#
# このスクリプトは GitHub Actions からの SSH アクセスを許可するため、
# デプロイ用の SSH キーペアを生成し、公開鍵を ~/.ssh/authorized_keys に登録します。
##############################################################################

set -e

echo "🔑 ========== GitHub Actions SSH セットアップ =========="

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

# ============= 1. SSH ディレクトリ確認 =============
log_info "SSH ディレクトリをチェック中..."

if [ ! -d ~/.ssh ]; then
  log_info "~/.ssh ディレクトリを作成中..."
  mkdir -p ~/.ssh
  chmod 700 ~/.ssh
else
  log_info "~/.ssh ディレクトリが存在します。"
fi

# ============= 2. デプロイ用 SSH キーペア生成 =============
log_info "GitHub Actions デプロイ用 SSH キーペアを生成中..."

DEPLOY_KEY_PATH="$HOME/.ssh/jomon-deploy"
DEPLOY_KEY_PUB="$DEPLOY_KEY_PATH.pub"

if [ -f "$DEPLOY_KEY_PATH" ]; then
  log_warn "デプロイキーが既に存在します。スキップします。"
else
  ssh-keygen -t rsa -b 4096 -f "$DEPLOY_KEY_PATH" -N "" -C "github-actions-jomon-deploy"
  log_info "デプロイキーペアを生成しました："
  log_info "  秘密鍵: $DEPLOY_KEY_PATH"
  log_info "  公開鍵: $DEPLOY_KEY_PUB"
fi

# ============= 3. 公開鍵を authorized_keys に登録 =============
log_info "公開鍵を authorized_keys に登録中..."

if [ ! -f ~/.ssh/authorized_keys ]; then
  touch ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  log_info "authorized_keys ファイルを作成しました。"
fi

# 既に登録されているか確認
if grep -q "github-actions-jomon-deploy" ~/.ssh/authorized_keys 2>/dev/null; then
  log_warn "公開鍵は既に authorized_keys に登録されています。スキップします。"
else
  cat "$DEPLOY_KEY_PUB" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  log_info "公開鍵を authorized_keys に追加しました。"
fi

# ============= 4. 秘密鍵の内容を表示 =============
echo ""
echo -e "${YELLOW}========== GitHub Secrets に登録する内容 ==========${NC}"
echo ""
echo "以下をコピーして、GitHub リポジトリの Settings > Secrets に登録してください："
echo ""
echo "【Secret Name】"
echo "  CONOHA_SSH_KEY"
echo ""
echo "【Secret Value】"
echo "以下の内容をすべてコピーしてください："
echo "---"
cat "$DEPLOY_KEY_PATH"
echo "---"
echo ""

# ============= 5. その他の情報 =============
log_info "その他の Secrets 設定項目："
echo ""
echo "【CONOHA_SERVER_IP】"
echo "  このサーバーの IP アドレスを確認してください："
hostname -I | awk '{print $1}'
echo ""

echo "【CONOHA_USER】"
echo "  ログインユーザー名："
whoami
echo ""

# ============= 6. 接続テスト =============
log_info "SSH 接続テストを実行中..."
echo ""

# localhost へのSSH接続テスト
if ssh -i "$DEPLOY_KEY_PATH" -o StrictHostKeyChecking=no localhost "echo 'SSH接続成功'" 2>/dev/null; then
  log_info "✅ SSH 接続テスト成功"
else
  log_warn "⚠️  SSH ローカル接続テストで問題が発生しました。"
  log_warn "ただし、GitHub Actions からの接続は正常に動作する可能性があります。"
fi

# ============= 7. セットアップ完了 =============
echo ""
echo -e "${GREEN}========== セットアップ完了 ==========${NC}"
echo ""
echo "✅ SSH デプロイキーペアを生成しました"
echo "✅ 公開鍵を authorized_keys に登録しました"
echo ""
echo "次のステップ："
echo "1. 上記の【Secret Value】をコピー"
echo "2. GitHub リポジトリ → Settings → Secrets → Actions"
echo "3. 新しい Secret を作成："
echo "   - Secret Name: CONOHA_SSH_KEY"
echo "   - Secret Value: (上記の秘密鍵を貼り付け)"
echo ""
echo "4. 以下の Secrets も設定："
echo "   - CONOHA_SERVER_IP: $(hostname -I | awk '{print $1}')"
echo "   - CONOHA_USER: $(whoami)"
echo ""
echo "5. GitHub Actions ワークフローを手動トリガーでテスト："
echo "   GitHub → Actions → ConoHa Auto Deploy & Remaster → Run workflow"
echo ""
