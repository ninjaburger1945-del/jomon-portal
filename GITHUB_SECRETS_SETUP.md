# GitHub Secrets セットアップガイド

## 概要

GitHub Secrets に保存された API キーをクローラーで使用する方法です。

改造されたクローラーは以下の環境変数から自動的に読み込みます：

| 環境変数 | 説明 |
|---------|------|
| `GoogleSearch_SERVICE_ACCOUNT` | Google Cloud Service Account JSON（GitHub Actions で実行する場合） |
| `GoogleSearch_CX` | Google Custom Search Engine ID |
| `GEMINI_API_KEY20261336` | Google Gemini API キー（既存） |

---

## GitHub Secrets に登録する手順

### 1️⃣ リポジトリの Settings を開く

```
GitHub.com → リポジトリ → Settings → Secrets and variables → Actions
```

### 2️⃣ 3 つの Secret を登録

#### A. GoogleSearch_CX（検索エンジン ID）

```
Name: GoogleSearch_CX
Value: 01234567890abcdef:xyz...
```

**取得方法**：
- [Programmable Search Engine](https://programmablesearchengine.google.com/cse/all)
- 管理画面で「検索エンジン ID」（cx）をコピー

---

#### B. GoogleSearch_SERVICE_ACCOUNT（サービスアカウント JSON）

**オプション A**: JSON をそのまま登録（推奨）

```
Name: GoogleSearch_SERVICE_ACCOUNT
Value: {
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  ...
}
```

**オプション B**: Base64 エンコード（セキュリティ向上）

```bash
# JSON ファイルを Base64 エンコード
base64 -i service-account.json

# 出力を Secret に登録
Name: GoogleSearch_SERVICE_ACCOUNT
Value: eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwuLi4=
```

クローラーが自動的にデコード処理を行います。

---

#### C. GEMINI_API_KEY20261336（既存）

既に登録されていれば、変更は不要です。

```
Name: GEMINI_API_KEY20261336
Value: AIzaSy...
```

---

## GitHub Actions で実行する場合

### ワークフローファイルの設定例

`.github/workflows/daily-crawler.yml`:

```yaml
name: Daily Jomon Portal Crawler

on:
  schedule:
    # 毎日午前9時（UTC+0）に実行
    # UTC+9 にするには 0 0 * * * にする（UTC 00:00 = JST 09:00）
    - cron: '0 0 * * *'

jobs:
  crawler:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      # ✅ 【重要】GitHub Secrets を環境変数として渡す
      - name: Run crawler
        env:
          GEMINI_API_KEY20261336: ${{ secrets.GEMINI_API_KEY20261336 }}
          GoogleSearch_CX: ${{ secrets.GoogleSearch_CX }}
          GoogleSearch_SERVICE_ACCOUNT: ${{ secrets.GoogleSearch_SERVICE_ACCOUNT }}
        run: node scripts/daily-crawler.js

      # 【オプション】生成されたデータをコミットして自動プッシュ
      - name: Commit and push changes
        run: |
          git config user.name "Jomon Portal Bot"
          git config user.email "bot@jomon-portal.local"
          git add app/data/facilities.json public/facilities.json
          git commit -m "chore(crawler): auto-added new Jomon facility via GitHub Actions" || true
          git push
```

---

## ローカル実行での確認

クローラーをローカルで実行してテストする場合：

### 1️⃣ `.env` ファイルを作成

```bash
cp .env.example .env
```

### 2️⃣ Google Cloud から JSON をダウンロード

1. [Google Cloud Console](https://console.cloud.google.com/)
2. サービスアカウント → キー → JSON をダウンロード

### 3️⃣ `.env` に追加

```bash
GEMINI_API_KEY20261336=AIzaSy...
GoogleSearch_CX=01234567890abcdef:xyz...
GoogleSearch_SERVICE_ACCOUNT={
  "type": "service_account",
  ...
}
```

**注意**: `.env` ファイルを Git にコミットしないこと！

```bash
# .gitignore に追加
echo ".env" >> .gitignore
```

### 4️⃣ テスト実行

```bash
node scripts/daily-crawler.js
```

ログ出力:

```
[INIT] Gemini API_KEY configured (xxx chars)
[INIT] Google Custom Search:
       - Service Account: ✅ configured
       - CX (検索エンジンID): ✅ configured
[CRAWLER] クローラー開始
[GOOGLE_SEARCH] 検索開始: "施設名"
[GOOGLE_SEARCH] ✅ N 件の URL候補を取得
```

---

## トラブルシューティング

### エラー: "Google Custom Search Service Account のパースに失敗"

**原因**: JSON が不正な形式

**解決**:
1. JSON の形式を確認（[jsonlint.com](https://jsonlint.com/)）
2. Base64 エンコードされているか確認

```bash
# Base64 確認
echo "$GoogleSearch_SERVICE_ACCOUNT" | base64 -d | head -20
```

---

### エラー: "API キーが見つかりません"

**原因**: Service Account JSON に `api_key` フィールドがない

**解決**: Google Cloud Console で API キーを新規作成

```
Google Cloud Console → API と サービス → 認証情報 → API キー
```

---

### エラー: "CX (検索エンジンID) が見つかりません"

**原因**: `GoogleSearch_CX` が登録されていない

**解決**:
1. [Programmable Search Engine](https://programmablesearchengine.google.com/cse/all)
2. 管理画面から ID（cx）をコピー
3. GitHub Secrets に `GoogleSearch_CX` として登録

---

## セキュリティについて

### ベストプラクティス

✅ **推奨**:
- Service Account JSON を Base64 エンコードして保存
- GitHub Secrets を使用（暗号化される）
- `.env` ファイルを `.gitignore` に追加

❌ **禁止**:
- JSON をそのまま Git にコミット
- 本番環境用 API キーをローカルで使用
- API キーをログ出力

### API キーのローテーション

定期的にキーを更新します：

```bash
# Google Cloud Console で新しいキーを生成
# GitHub Secrets を更新
# 古いキーを削除
```

---

## まとめ

| 項目 | ステータス |
|------|-----------|
| GitHub Secrets 登録 | ✅ 完了 |
| クローラー改造 | ✅ 完了 |
| GitHub Actions ワークフロー | ⏳ 配置予定 |
| ローカル テスト | ⏳ 実行予定 |

---

## 参考リンク

- [GitHub Actions: Using Secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [Google Cloud: Creating Service Accounts](https://cloud.google.com/iam/docs/service-accounts-create)
- [Programmable Search Engine](https://programmablesearchengine.google.com/cse/all)
