# クローラー改造 v2.0 - テスト＆検証ガイド

## 🧪 ローカルテスト手順

### 準備

#### 1. 依存パッケージのインストール

```bash
npm install
```

#### 2. Google Cloud から Service Account JSON をダウンロード

[Google Cloud Console](https://console.cloud.google.com/)
→ Service Accounts → キー → JSON をダウンロード

#### 3. `.env` ファイルを作成

```bash
cp .env.example .env
```

`.env` に以下を追加（例）:

```bash
GEMINI_API_KEY20261336=AIzaSy...your-gemini-api-key...
GoogleSearch_CX=01234567890abcdef:xyz...your-cx-id...
GoogleSearch_SERVICE_ACCOUNT={
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-sa@project.iam.gserviceaccount.com",
  ...
}
```

**⚠️ 注意**: `.env` を Git にコミットしないこと！

```bash
echo ".env" >> .gitignore
```

---

### テスト実行

#### 基本テスト

```bash
node scripts/daily-crawler.js
```

**期待される出力**:

```
[INIT] Gemini API_KEY configured (xxx chars)
[INIT] Google Custom Search:
       - Service Account: ✅ configured
       - CX (検索エンジンID): ✅ configured
[CRAWLER] クローラー開始
[CRAWLER] 既存データ: 45 件読み込み
[CRAWLER] Gemini API にリクエスト (地方: 東北)...
[GOOGLE_SEARCH] 検索開始: "施設名"
[GOOGLE_SEARCH] ✅ N 件の URL候補を取得
[URL_CONFIRMED] ✅ 新しい施設 → https://...
[IMAGE] ✅ 画像生成成功: /images/facilities/...
[ADDED] ✓ 046 - 新しい施設名
[RESULT] ✅ 1 件追加、合計 46 件
```

#### API キーなしテスト（フォールバック検証）

```bash
# GoogleSearch_SERVICE_ACCOUNT を削除
unset GoogleSearch_SERVICE_ACCOUNT

# クローラーを実行（Gemini の候補にフォールバック）
node scripts/daily-crawler.js
```

**期待される出力**:

```
[INIT] Google Custom Search:
       - Service Account: ⚠️ not configured
       - CX (検索エンジンID): ✅ configured
[WARN] Google Custom Search API は完全には構成されていません。
       Gemini のフォールバック使用時、URL検出精度が低下します。
```

---

## 🔍 ログ解析

### ケース1: 正常系（Google Custom Search で発見）

```bash
[GOOGLE_SEARCH] 検索開始: "三内丸山遺跡" (青森県)
[GOOGLE_SEARCH] API呼び出し: 三内丸山遺跡 青森県 遺跡 公式
[GOOGLE_SEARCH] ✅ 4 件の URL候補を取得（優先度順）
   [自治体公式] 特別史跡 三内丸山遺跡 - 青森県
              https://sannaimaruyama.pref.aomori.jp/
   [政府機関] 国指定史跡 データベース
              https://kunishitei.bunka.go.jp/...
   [公開サイト] 観光情報
              https://aomori-tourism.com/...
[VALIDATE_CANDIDATE] https://sannaimaruyama.pref.aomori.jp/ を検証中
[CONTENT_VERIFIED] https://sannaimaruyama.pref.aomori.jp/
   スコア: 35 | キーワード: 縄文, 遺跡, 史跡 | ...
[BEST_URL_SELECTED] ✅ https://sannaimaruyama.pref.aomori.jp/ (採用)
```

✅ **結果**: Google 検索で正しい URL が発見された

---

### ケース2: 404 自動対応

```bash
[VALIDATE_CANDIDATE] https://old.example.jp/facility を検証中
[URL_FIX_ATTEMPT] https://old.example.jp/facility を検証中...
[URL_DEAD] ❌ URL が無効です (ステータス: 404)
[URL_FIX_SEARCH] Google Custom Search で代替 URL を検索中...
[GOOGLE_SEARCH] 検索開始: "施設名" (都道府県)
[GOOGLE_SEARCH] ✅ 3 件の URL候補を取得（優先度順）
   [自治体公式] https://example.lg.jp/new-url
   ...
[URL_FIX_SUCCESS] ✅ 代替 URL を発見: https://example.lg.jp/new-url
[BEST_URL_SELECTED] ✅ https://example.lg.jp/new-url (採用)
   [注記] Gemini の提案 URL が無効だったため、Google 検索で代替 URL に自動置換されました
```

✅ **結果**: 404 が自動検出され、代替 URL に置換された

---

### ケース3: 柔軟な名前判定

```bash
[NAME_CHECK] ✅ 施設名完全一致: 三内丸山遺跡 (5回出現)
[NAME_CHECK] ⚠️  施設名部分一致: 三内丸山 (12回出現)
[NAME_CHECK] ✅ 施設名未検出だが縄文関連キーワード検出: 新しい施設名
   キーワード: 遺跡, 博物館, 土器, 貝塚 (複数検出)
```

✅ **結果**: 完全一致がなくても、関連キーワードで許容された

---

## 📊 テストケース一覧

| テストケース | 入力 | 期待される出力 | 確認項目 |
|-----------|------|--------|---------|
| **基本動作** | クローラー実行 | 施設が1件追加される | `[ADDED] ✓ ID - 施設名` |
| **Google Search** | 施設名検索 | 複数 URL 候補を取得 | `[GOOGLE_SEARCH] ✅ N 件` |
| **404 対応** | 404 URL を提案 | 代替 URL に自動置換 | `[URL_FIX_SUCCESS]` |
| **名前判定** | 曖昧な施設名 | キーワードで許容 | `[NAME_CHECK] ✅ キーワード検出` |
| **フォールバック** | API キーなし | Gemini 候補を使用 | `[FALLBACK_GOOGLE_SEARCH]` |
| **連続実行** | 複数回実行 | 重複排除される | `[DUPLICATE] スキップ` |

---

## ✅ チェックリスト

実装後に以下を確認してください：

### API キー確認

- [ ] Gemini API キーが有効
- [ ] Google Custom Search Service Account が有効
- [ ] Google Custom Search Engine ID (CX) が正確
- [ ] API キーがログに出力されていない（セキュリティ）

### 機能確認

- [ ] Google Custom Search で検索できる
- [ ] 404 URL が自動検出される
- [ ] 代替 URL が発見される
- [ ] 名前が柔軟に判定される
- [ ] 画像が生成される
- [ ] データが DB に保存される

### ログ確認

- [ ] エラーログに機密情報がない
- [ ] ログレベルが適切
- [ ] タイムスタンプが正確

### GitHub Actions 確認

- [ ] Secrets が正しく設定されている
- [ ] ワークフローが毎日実行される
- [ ] 自動コミット・プッシュが動作する
- [ ] 失敗時に通知される（オプション）

---

## 🐛 デバッグ方法

### 詳細ログを出力

```bash
# ログレベルを DEBUG に設定（実装時）
DEBUG=1 node scripts/daily-crawler.js
```

### Google API の応答を確認

```bash
# API レスポンスをファイルに保存
node scripts/daily-crawler.js 2>&1 | tee crawler.log

# ログを分析
grep -A 5 "GOOGLE_SEARCH" crawler.log
grep -A 5 "URL_FIX" crawler.log
```

### 特定の施設をテスト

クローラーのプロンプトを修正して、特定施設のみを試す：

```javascript
const prompt = `
【テストモード】
施設「〇〇遺跡」に関する情報を提案してください。
...
`;
```

---

## 🔄 継続的な検証

### 週次チェック

```bash
# 毎週月曜日に手動実行
git log --oneline --since="1 week ago" | head -10

# 新しく追加された施設を確認
git diff HEAD~7 -- app/data/facilities.json | grep '"name"' | head -5
```

### 月次レポート

```bash
# 1ヶ月間に追加された施設数
TOTAL=$(grep -c '"id"' app/data/facilities.json)
MONTH_AGO=$((TOTAL - $(git show HEAD~30:app/data/facilities.json | grep -c '"id"')))
echo "先月追加: $MONTH_AGO 件"
```

---

## 📞 トラブルシューティング

### よくあるエラーと対処法

#### エラー: "GEMINI_API_KEY20261336 環境変数が設定されていません"

```bash
# 環境変数を確認
echo $GEMINI_API_KEY20261336

# .env から読み込み（もし使用している場合）
source .env
```

#### エラー: "Google Custom Search Service Account のパースに失敗"

```bash
# JSON の形式を確認
echo $GoogleSearch_SERVICE_ACCOUNT | python3 -m json.tool

# または Base64 をデコード
echo $GoogleSearch_SERVICE_ACCOUNT | base64 -d | python3 -m json.tool
```

#### エラー: "No candidates in API response"

- Gemini API の利用上限に達している
- API キーが無効
- API の応答形式が変わった

**対応**: Google Cloud Console で利用状況を確認

---

## 🎯 本番環境への移行

1. ✅ ローカルでテスト完了
2. ✅ ログを確認して問題なし
3. ✅ GitHub Secrets に登録完了
4. ✅ ワークフローが配置済み

→ GitHub Actions で自動実行開始！

---

## 📚 参考資料

- [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md) - GitHub Secrets の設定
- [CRAWLER_UPDATE_v2.md](CRAWLER_UPDATE_v2.md) - 改造内容の詳細
- [scripts/daily-crawler.js](scripts/daily-crawler.js) - ソースコード
