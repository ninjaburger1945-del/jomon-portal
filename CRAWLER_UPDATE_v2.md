# クローラー改造 v2.0 - 「URL全滅エラー回避仕様」完成

## 🎯 今回の改造内容

### 1️⃣ Google Custom Search API の完全統合

**新機能**: Gemini が提案した施設名をキーワードに、実際の Google 検索を自動実行

```javascript
// GitHub Secrets から自動読み込み
GoogleSearch_SERVICE_ACCOUNT  ← Service Account JSON（Base64対応）
GoogleSearch_CX               ← 検索エンジン ID
```

**動作フロー**:
```
Gemini が施設候補を提案
    ↓
Google Custom Search で施設名を検索
    ↓
検索結果を優先度順に抽出（.lg.jp > .go.jp > .or.jp）
    ↓
最初に有効な URL を採用
```

**優先度**:
- 優先度1：`.lg.jp/`（自治体公式）
- 優先度2：`.go.jp/`（政府機関）
- 優先度3：`.or.jp/`（公開サイト）

---

### 2️⃣ 404 自動対応（最大の改造！）

**新関数**: `searchAndFixUrlViaGoogle()`

Gemini が提案した URL が 404 の場合、**自動的に Google 検索で代替 URL を発見**

```javascript
Gemini: "この URL をチェックして" → https://example.jp/old-url
         ↓ (404 検出)
Google Search: "代わりにこれはどう？" → https://example.lg.jp/new-url
         ↓ (検証成功)
DB に自動保存 ✅
```

**メリット**:
- ✅ 自治体が URL を変更しても自動追従
- ✅ 削除済みページを避ける
- ✅ 「中部地方で全滅」という事態が回避される

---

### 3️⃣ バリデーション柔軟化（4段階判定）

施設名の一致判定を大幅に緩和：

**優先度1**：施設名完全一致
```javascript
"三内丸山遺跡" が含まれる → ✅ OK
```

**優先度2**：施設名の主要部分一致
```javascript
"三内丸山遺跡" → "三内丸山" が含まれる → ✅ OK
```

**優先度3**：年号マッチ
```javascript
"弥生xxx遺跡" → "弥生" が含まれる → ✅ OK
```

**優先度4**：縄文関連キーワード
```javascript
"遺跡" "博物館" "史跡" "考古" "土器" "貝塚"
"土偶" "縄文" のいずれかが含まれる → ✅ OK
```

**従来との違い**:
| 従来 | 改造後 |
|------|--------|
| 「三内丸山遺跡」が完全一致しないと NG | 「三内丸山」だけでも OK |
| 「遺跡」キーワード程度では NG | 複数のキーワードで OK |

---

## 📊 実装の全体フロー

```
┌─────────────────────────────────────────────────────┐
│ 1. GitHub Actions で定時実行（毎日9時）             │
│    ↓ GitHub Secrets から API キーを自動読み込み    │
└──────────────┬──────────────────────────────────────┘

┌──────────────▼──────────────────────────────────────┐
│ 2. Gemini API が施設候補を提案                      │
│    - 施設名、URL候補、説明文など                   │
└──────────────┬──────────────────────────────────────┘

┌──────────────▼──────────────────────────────────────┐
│ 3. Google Custom Search で施設名を検索              │
│    - 優先度：.lg.jp > .go.jp > .or.jp              │
└──────────────┬──────────────────────────────────────┘

┌──────────────▼──────────────────────────────────────┐
│ 4. URL 検証（404自動対応付き）                      │
│    ┌───────────────────────────────────────────┐  │
│    │ Gemini URL をチェック                      │  │
│    │ ✅ OK → そのまま採用                      │  │
│    │ ❌ 404 → Google 検索で代替 URL を発見    │  │
│    └───────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────┘

┌──────────────▼──────────────────────────────────────┐
│ 5. バリデーション（柔軟な名前判定）                 │
│    - 施設名完全一致でなくても、キーワード検出で OK │
└──────────────┬──────────────────────────────────────┘

┌──────────────▼──────────────────────────────────────┐
│ 6. AI 画像生成 & DB 保存                            │
│    - app/data/facilities.json に追加               │
│    - 自動コミット・プッシュ                        │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 技術仕様

### 新関数一覧

| 関数 | 役割 |
|------|------|
| `searchUrlsViaGoogleCustomSearch()` | Google Custom Search API を呼び出し、優先度順に URL を抽出 |
| `searchAndFixUrlViaGoogle()` | 404 検出時に代替 URL を自動発見 |
| `validateCandidateUrls()` | 複数 URL を検証、404 対応を含む |

### 環境変数（GitHub Secrets）

| Secret 名 | 値 | 説明 |
|---------|-----|------|
| `GoogleSearch_SERVICE_ACCOUNT` | JSON（Base64可） | Google Cloud Service Account |
| `GoogleSearch_CX` | 文字列 | Google Custom Search Engine ID |
| `GEMINI_API_KEY20261336` | 文字列 | Google Gemini API Key（既存） |

---

## 🚀 デプロイ手順

### Step 1: GitHub Secrets に登録

```
GitHub → Settings → Secrets and variables → Actions
```

3 つの Secret を登録：
- `GoogleSearch_CX`
- `GoogleSearch_SERVICE_ACCOUNT`
- `GEMINI_API_KEY20261336`

詳細は `GITHUB_SECRETS_SETUP.md` を参照

### Step 2: ワークフローファイルを配置

`.github/workflows/daily-crawler.yml` が自動配置されています。

### Step 3: テスト実行

```bash
# ローカルで環境変数を設定してテスト
GoogleSearch_CX=xxx GoogleSearch_SERVICE_ACCOUNT='{...}' \
GEMINI_API_KEY20261336=yyy \
node scripts/daily-crawler.js
```

### Step 4: GitHub Actions で自動実行

毎日午前 9 時（JST）に自動実行開始！

---

## 📈 期待される効果

| 項目 | 従来 | 改造後 |
|------|------|--------|
| **URL 検出方法** | Gemini の知識のみ | + 実際の Google 検索 |
| **404 対応** | ❌ 404 で終了 | ✅ 自動的に代替 URL を発見 |
| **名前判定** | 厳密 | 非常に柔軟 |
| **「全滅」リスク** | 高い | 低い（Google 検索で代替可） |
| **自治体 URL 変更対応** | 手動 | ✅ 自動 |
| **放置しても増える** | 限定的 | ✅ 毎日自動 |
| **コスト** | 無料 | 無料（Google Custom Search 無料枠内） |

---

## 🐛 トラブルシューティング

### エラー: "Google Custom Search API が完全に構成されていません"

**原因**: GitHub Secrets が未設定

**解決**: `GITHUB_SECRETS_SETUP.md` を参照

---

### エラー: "URL is dead and no valid alternative found"

**原因**: Google 検索でも施設が見つからない

**対応**:
- Gemini に別の施設名を提案させる
- 自治体に直接確認

---

### 404 検出ロジックが誤動作

**ログで確認**:
```
[URL_FIX_ATTEMPT] https://example.jp を検証中...
[URL_DEAD] ❌ URL が無効です (ステータス: 404)
[URL_FIX_SEARCH] Google Custom Search で代替 URL を検索中...
```

---

## 📝 ログの読み方

### 成功時

```
[GOOGLE_SEARCH] 検索開始: "施設名"
[GOOGLE_SEARCH] ✅ 3 件の URL候補を取得（優先度順）
   [自治体公式] 施設の説明
              https://example.lg.jp/...
[VALIDATE_CANDIDATE] https://example.lg.jp/... を検証中
[CONTENT_VERIFIED] https://example.lg.jp/...
[BEST_URL_SELECTED] ✅ https://example.lg.jp/... (採用)
```

### 404 対応時

```
[URL_FIX_ATTEMPT] https://example.jp/old を検証中...
[URL_DEAD] ❌ URL が無効です (ステータス: 404)
[URL_FIX_SEARCH] Google Custom Search で代替 URL を検索中...
[GOOGLE_SEARCH] ✅ 2 件の URL候補を取得
[URL_FIX_SUCCESS] ✅ 代替 URL を発見: https://example.lg.jp/new
[BEST_URL_SELECTED] ✅ https://example.lg.jp/new (採用)
   [注記] Gemini の提案 URL が無効だったため、Google 検索で代替 URL に自動置換されました
```

---

## 🎉 まとめ

✅ **Google Custom Search API 統合** - 実際の検索結果から URL を取得
✅ **404 自動対応** - 無効な URL を自動検出して代替 URL を発見
✅ **バリデーション柔軟化** - 完全一致がなくても信頼できるページなら採用
✅ **GitHub Secrets 対応** - セキュアに API キーを管理
✅ **毎日自動実行** - GitHub Actions で無人運用可能

**結果**: 放置していても毎日勝手に施設データが増え、URL 切れにも自動対応！🚀
