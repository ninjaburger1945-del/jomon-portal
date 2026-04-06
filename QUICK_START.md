# 🚀 クイックスタート - Google Custom Search API 統合版

## 📍 今何が変わったのか

1. **Google Custom Search API** で実際の検索結果から URL を取得
2. **NAME_MISMATCH チェックを柔軟化** （「遺跡」キーワードでも許容）
3. **定期実行で自動増殖** する仕組みに改造

---

## ⚡ 最速セットアップ（5分）

### 1️⃣ `.env` ファイルを作成

```bash
cp .env.example .env
```

### 2️⃣ Google API キーを取得（3分）

👉 ブラウザで以下を開く：
- [Google Cloud Console](https://console.cloud.google.com/) - Custom Search API を有効化
- [Programmable Search Engine](https://programmablesearchengine.google.com/cse/all) - 検索エンジンを作成

詳細は `GOOGLE_SEARCH_SETUP.md` 参照

### 3️⃣ `.env` に API キーを入力

```bash
GEMINI_API_KEY20261336=<既存のキー>
GOOGLE_SEARCH_API_KEY=AIzaSyD...
GOOGLE_SEARCH_ENGINE_ID=01234567890abc:xyz...
```

### 4️⃣ テスト実行

```bash
node scripts/daily-crawler.js
```

ログに以下が表示されれば OK：

```
[INIT] Gemini API_KEY configured
[INIT] Google Custom Search: ✅ configured
[GOOGLE_SEARCH] 検索開始: "施設名"
[GOOGLE_SEARCH] ✅ N 件の URL候補を取得
```

---

## ⏰ 定期実行を設定

### Linux/Mac

```bash
# crontab を編集
crontab -e

# 以下を追加（毎日午前9時）
0 9 * * * cd /path/to/jomon-portal && node scripts/daily-crawler.js >> logs/crawler.log 2>&1
```

### Windows

1. 「タスクスケジューラ」を開く
2. 基本タスクを作成
3. トリガー：毎日 9:00 AM
4. アクション：プログラム実行
   - プログラム：`node.exe`
   - 引数：`scripts/daily-crawler.js`
   - 作業ディレクトリ：`C:\Users\ninja\...\jomon-portal`

---

## 🎯 改造のメリット

| 従来 | 改造後 |
|------|--------|
| Gemini の知識に依存 | 🔍 Google の実際の検索結果を使用 |
| 「全滅」のリスク | ✅ 自動で最新 URL を発見 |
| 名前判定が厳密 | ✅ 「遺跡」などのキーワードで許容 |
| 手動で実行必要 | ⏰ 自動で毎日実行可能 |

---

## 📊 今後の流れ

```
毎日午前9時
    ↓
Google Custom Search で施設を検索
    ↓
複数 URL 候補を検証（柔軟な NAME_MISMATCH チェック）
    ↓
有効な URL を発見 → DB に追加
    ↓
AI 画像生成 → facilities.json に保存
```

**結果**: 放置していても毎日データが増える！

---

## ❓ API キーを取得できない？

問題ありません。Google Custom Search API なしでも動作します。

```
Google Custom Search: ⚠️ not configured (will fallback to Gemini)
    ↓
自動的に Gemini の候補に切り替わる
```

ただし、検出精度は低下します。

---

## 📞 詳細情報

- 🔧 セットアップ詳細：`GOOGLE_SEARCH_SETUP.md`
- 📝 改造内容：`UPDATE_CHANGELOG.md`
- 💾 環境変数例：`.env.example`

---

## ✅ 動作確認チェックリスト

- [ ] `.env` ファイルを作成
- [ ] Google API キーを取得
- [ ] `.env` に API キーを入力
- [ ] `node scripts/daily-crawler.js` でテスト実行
- [ ] ログで成功を確認
- [ ] cron / タスクスケジューラで定期実行を設定
- [ ] facilities.json に新施設が追加されるか確認

完了したら、あとは放置しても毎日自動で増えます！🎉
