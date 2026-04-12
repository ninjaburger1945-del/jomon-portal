# 🏺 ConoHa 自動化セットアップ完全ガイド

Vercel から ConoHa（Ubuntu 24.04）への移行に伴い、自動化ワークフローを再構築するための完全ガイドです。

## 📋 目次

1. [サーバー準備](#サーバー準備)
2. [自動セットアップの実行](#自動セットアップの実行)
3. [GitHub Secrets 設定](#github-secrets-設定)
4. [動作確認](#動作確認)
5. [トラブルシューティング](#トラブルシューティング)

---

## サーバー準備

### 前提条件

- Ubuntu 24.04 が稼働している ConoHa サーバー
- SSH アクセス可能
- Node.js 18+ インストール済み
- Nginx 設定済み（ポート 3000 へプロキシ）

### 初期チェック

```bash
# SSH でサーバーに接続
ssh your_user@your_server_ip

# Node.js バージョン確認
node --version  # v18以上であることを確認
npm --version

# 作業ディレクトリ移動
cd ~
```

---

## 自動セットアップの実行

### ステップ 1: リポジトリをクローン

```bash
cd ~
git clone https://github.com/ninjaburger1945-del/jomon-portal.git
cd jomon-portal
```

### ステップ 2: セットアップスクリプト実行

```bash
bash scripts/setup-conoha.sh
```

このスクリプトが以下を自動実行します：

- ✅ Node.js & PM2 バージョン確認
- ✅ `logs/` ディレクトリ作成
- ✅ npm 依存関係インストール
- ✅ `.env.local` ファイルのチェック
- ✅ PM2 スタートアップ設定
- ✅ Cron ジョブ自動登録

### ステップ 3: 環境変数の設定

セットアップスクリプトが `.env.local` を作成します。API キーを設定してください：

```bash
nano .env.local
```

以下の値を設定：

```env
GOOGLE_GENERATIVE_AI_API_KEY=sk-...  # Gemini API キー
GEMINI_API_KEY20261336=sk-...        # 同上
GOOGLE_CUSTOM_SEARCH_API_KEY=...     # Google Custom Search API キー
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=...   # 検索エンジン ID
GITHUB_TOKEN=ghp_...                  # GitHub Personal Access Token
```

### ステップ 4: PM2 プロセス確認

```bash
pm2 status
```

以下のプロセスが起動していることを確認：

- `jomon-web` — Webサーバー
- `jomon-crawler` — デイリークローラー
- `jomon-refine` — データリマスター
- `jomon-regenerate-images` — イラスト再生成
- `jomon-generate-missing` — 欠落イラスト生成
- `jomon-events` — イベントコレクト

### ステップ 5: GitHub Actions SSH セットアップ（自動デプロイ有効化）

GitHub Actions からの自動デプロイを有効にするため、SSH キーペアを生成します：

```bash
bash scripts/setup-github-ssh.sh
```

このスクリプトが以下を実行：
- デプロイ用 SSH キーペア生成（`~/.ssh/jomon-deploy`）
- 公開鍵を `~/.ssh/authorized_keys` に登録
- **秘密鍵を表示**（コピーして使用）

⚠️ **重要：** スクリプト実行後に表示される秘密鍵を**全文コピー**し、次のステップで GitHub Secrets に登録してください。

---

## GitHub Secrets 設定

GitHub Actions による自動デプロイを有効にするため、Secrets を設定します。

### GitHub リポジトリ設定

1. GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** をクリック

### 設定する Secrets（順番重要）

| Secret Name | 説明 | 優先度 |
|-------------|------|--------|
| `CONOHA_SSH_KEY` | ConoHa SSH **秘密鍵**（setup-github-ssh.sh実行後） | 🔴 必須 |
| `CONOHA_SERVER_IP` | ConoHa サーバー IP アドレス | 🔴 必須 |
| `CONOHA_USER` | サーバーのログインユーザー名 | 🔴 必須 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API キー | 🔴 必須 |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | Google Custom Search API | 🔴 必須 |
| `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` | カスタム検索エンジン ID | 🔴 必須 |
| `SLACK_WEBHOOK` | Slack 通知用 Webhook URL | 🟡 オプション |

### 詳細な登録手順

**詳しくは [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) を参照してください。**

**重要なポイント：**
1. `bash scripts/setup-github-ssh.sh` を実行して秘密鍵を生成
2. 表示された秘密鍵を**全文**コピー（`-----BEGIN` から `-----END` まで）
3. GitHub Secrets に登録：
   - `CONOHA_SSH_KEY` = 秘密鍵の内容
   - `CONOHA_SERVER_IP` = サーバーの IP アドレス
   - `CONOHA_USER` = ログインユーザー名
4. API キーも登録
5. GitHub Actions で手動トリガーテスト

---

## 自動実行スケジュール

| 時刻 | 曜日 | タスク | スクリプト |
|------|------|--------|-----------|
| 2:00 | 毎日 | デイリークローラー | `daily-crawler.js` |
| 3:00 | 毎日 | データリマスター | `refine-facilities.js` |
| 3:30 | 土曜 | イラスト再生成 | `regenerate-images.js` |
| 4:00 | 土曜 | 欠落イラスト生成 | `generate-missing-images.js` |
| 4:30 | 日曜 | イベントコレクト | `collect-events.js` |
| 5:00 | 月曜 | 全体ビルド＆デプロイ | `npm run build` |

※ すべて日本時間（JST）

---

## 動作確認

### ログ確認

```bash
# すべてのログをリアルタイム表示
pm2 logs

# 特定のプロセスのログ
pm2 logs jomon-crawler
pm2 logs jomon-regenerate-images

# ログファイル直接確認
tail -100f logs/crawler.log
tail -100f logs/regenerate-images.log
```

### スクリプト手動実行テスト

```bash
# クローラーをテスト実行
node scripts/daily-crawler.js

# リマスターをテスト実行
node scripts/refine-facilities.js

# イラスト生成をテスト実行（時間がかかる可能性あり）
node scripts/regenerate-images.js
```

### Cron 確認

```bash
# 設定済み Cron ジョブ確認
crontab -l

# Cron ログ確認
sudo journalctl -u cron --no-pager | tail -20
```

---

## トラブルシューティング

### PM2 プロセスが起動しない

```bash
# ステータス確認
pm2 status

# エラーログ確認
pm2 logs jomon-web --err

# プロセス再起動
pm2 restart jomon-web

# 全プロセス停止・再起動
pm2 stop all
pm2 restart all
```

### メモリ不足で落ちる

イラスト生成タスクはメモリを多く使用します：

```bash
# メモリ制限を増やす
pm2 restart jomon-regenerate-images --max-memory-restart 2G

# または ecosystem.config.js を編集
nano ecosystem.config.js
# max_memory_restart の値を変更
```

### Cron が実行されない

```bash
# Cron デーモン再起動
sudo systemctl restart cron

# 環境変数が設定されているか確認
env | grep GOOGLE_

# .env.local を source していることを確認
source ~/.env.local
```

### npm インストールエラー（ピアデペンデンシー衝突）

ConoHa環境は `--legacy-peer-deps` フラグで対応済みです：

```bash
# 手動インストール時
npm install --legacy-peer-deps

# または .npmrc で設定済みのため通常のインストールでも動作
npm install
```

設定内容：
- `.npmrc` にピアデペンデンシー無視設定
- `auto-deploy.yml` で npm install に --legacy-peer-deps を指定
- `setup-conoha.sh` で npm install に --legacy-peer-deps を指定

### API キーエラー

```bash
# .env.local が正しく設定されているか確認
cat .env.local

# PM2 が環境変数を読み込んでいるか確認
pm2 restart all
pm2 logs jomon-crawler --err
```

### GitHub Actions デプロイが失敗

1. GitHub Actions ログを確認：
   - リポジトリ → **Actions** → 失敗したワークフロー
   
2. Secrets が正しく設定されているか確認：
   - Settings → Secrets → 各キーが存在するか

3. SSH キーのパーミッション確認：
   ```bash
   ls -la ~/.ssh/id_rsa  # 600 であることを確認
   ```

---

## メンテナンスコマンド

```bash
# PM2 ステータス確認
pm2 status

# すべてのログを表示
pm2 logs

# 特定のプロセスを再起動
pm2 restart jomon-crawler

# すべてのプロセスを再起動
pm2 restart all

# プロセスを停止
pm2 stop jomon-crawler

# プロセスを削除
pm2 delete jomon-crawler

# ログファイルをクリア
pm2 flush

# PM2 自体を再起動
sudo systemctl restart pm2-root

# Cron を手動トリガー（テスト用）
cd ~/jomon-portal && node scripts/daily-crawler.js
```

---

## GitHub Actions ワークフロー

自動デプロイワークフローは以下のタイミングで実行：

- **毎日 1:00 AM JST**（UTC 16:00）— クローラー実行後
- **毎週土曜 5:00 AM JST**（UTC 20:00）— イラスト処理後

手動トリガーも可能：

1. GitHub → **Actions** → **ConoHa Auto Deploy & Remaster**
2. **Run workflow** をクリック

---

## まとめ

✅ セットアップ完了後、以下が自動で動作します：

- 毎日の考古学ニュース取得
- データの自動整形・最適化
- AI による画像生成・更新
- イベント情報の自動収集
- GitHub への自動デプロイ

🏺 Jomon Portal は常に最新の情報で稼働します！

---

### サポート

問題が発生した場合：

1. ログを確認：`pm2 logs`
2. スクリプトをテスト実行
3. GitHub Issues で報告
