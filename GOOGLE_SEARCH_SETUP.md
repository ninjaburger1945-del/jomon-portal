# Google Custom Search API セットアップガイド

## 概要

Google Custom Search API を統合することで、クローラーが **実際の Google 検索結果** から最新の施設 URL を取得できるようになります。

Gemini の知識だけに頼らず、日々更新される Google 検索インデックスを活用するため、自治体が URL を変更した場合でも自動的に最新 URL を発見できます。

---

## セットアップ手順

### 1️⃣ Google Cloud プロジェクトの作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成（例：「jomon-portal」）

### 2️⃣ Custom Search API の有効化

1. Google Cloud Console で 「API と サービス」 → 「ライブラリ」 を開く
2. 検索ボックスで「Custom Search API」と検索
3. 結果をクリックして、「有効にする」をクリック

### 3️⃣ API キーの取得

1. 「API と サービス」 → 「認証情報」 を開く
2. 「認証情報を作成」 → 「API キー」 を選択
3. **API Key** をコピー（例：`AIzaSyDxxxxxxxxxxxxxxxxxx`）

### 4️⃣ 検索エンジン ID の取得

1. [Programmable Search Engine](https://programmablesearchengine.google.com/cse/all) を開く
2. 「新しい検索エンジンを作成」 をクリック
3. 設定例：
   - **検索するサイト**：`example.jp` など（初期設定、後で修正可）
   - **言語**：Japanese
4. 作成後、「検索エンジン ID」（cx パラメータ）をコピー（例：`01234567890abcdef:xyz...`）

### 5️⃣ 検索フィルタの設定（推奨）

1. Programmable Search Engine の管理画面で、作成した検索エンジンをクリック
2. 「制御パネル」 → 「サイト」 で不要なサイトを除外
3. 必要に応じて、特定ドメイン（例：`*.jp`）に限定

---

## 環境変数の設定

### `.env` ファイルを作成

`jomon-portal/.env` に以下を追加：

```bash
# 既存
GEMINI_API_KEY20261336=AIzaSy...

# 新規追加
GOOGLE_SEARCH_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxx
GOOGLE_SEARCH_ENGINE_ID=01234567890abcdef:xyz...
```

### Node.js での自動読み込み

`dotenv` は既に `package.json` に含まれています。
`.env` ファイルを配置するだけで自動読み込みされます。

---

## 料金について

### Google Custom Search API

- **無料枠**：1日あたり 100 クエリ（月3,000クエリ）
- **有料**：1,000クエリあたり $5.00

### 推奨設定

```javascript
// 1日1回のクローラー実行 → 月30クエリ（無料枠内）
// 安定運用にはおすすめ
```

---

## テスト方法

```bash
# クローラーを手動実行
node scripts/daily-crawler.js

# ログで確認
# [GOOGLE_SEARCH] 検索開始: "施設名"
# [GOOGLE_SEARCH] ✅ N 件の URL候補を取得
```

---

## トラブルシューティング

### API キーが無効エラー

- API キーを正しくコピーしたか確認
- `.env` ファイルのパスと読み込みを確認

### 検索エンジン ID が見つからない

- Programmable Search Engine 管理画面で ID を確認
- `cx` パラメータをコピー

### 検索結果が少ない

- 検索フィルタが厳しすぎる可能性
- 制御パネルで除外サイトを確認

---

## 自動実行設定

クローラーを定期実行する場合：

### Linux/Mac（cron）

```bash
# 毎日午前9時に実行
0 9 * * * cd /path/to/jomon-portal && node scripts/daily-crawler.js >> logs/crawler.log 2>&1
```

### Windows（タスクスケジューラ）

1. タスクスケジューラを開く
2. 基本タスクを作成
3. トリガー：毎日 9:00
4. アクション：プログラム実行
   - プログラム：`node.exe`
   - 引数：`scripts/daily-crawler.js`
   - 作業ディレクトリ：`C:\Users\ninja\.gemini\antigravity\scratch\jomon-portal`

---

## 監視とログ

### ログファイルの作成

```bash
# logs ディレクトリを作成
mkdir logs

# クローラーを標準出力でログ保存
node scripts/daily-crawler.js > logs/$(date +%Y-%m-%d).log 2>&1
```

### 失敗時の通知設定

メール通知や Slack 連携も検討。詳細は別ガイドで。

---

## まとめ

| 項目 | 設定状況 |
|------|--------|
| Google Custom Search API | ✅ セットアップ完了後に有効 |
| 無料枠 | ✅ 月3,000クエリ |
| クローラー統合 | ✅ `daily-crawler.js` に実装済み |
| フォールバック | ✅ API キー未設定時は Gemini に自動切り替え |

Google Custom Search API により、**自動でデータが増え続ける** 仕組みが完成します。🚀
