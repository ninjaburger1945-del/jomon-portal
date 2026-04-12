# 🔑 GitHub Secrets セットアップ完全ガイド

GitHub Actions から ConoHa へ自動デプロイするために必要な Secrets 設定の詳細ガイドです。

## 📋 概要

GitHub Actions のワークフロー（`auto-deploy.yml`）がConoHaサーバーにSSH接続してデプロイするには、以下の Secrets を設定する必要があります。

---

## 必要な Secrets 一覧

| Secret名 | 説明 | 取得方法 |
|---------|------|--------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API キー | Google Cloud Console |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | Google Custom Search API キー | Google Cloud Console |
| `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` | カスタム検索エンジンID | Google Custom Search |
| `CONOHA_SSH_KEY` | ConoHa SSH 秘密鍵 | 後述のセットアップスクリプト |
| `CONOHA_SERVER_IP` | ConoHa サーバーの IP アドレス | ConoHa コントロールパネル |
| `CONOHA_USER` | SSH ログインユーザー名 | サーバーのユーザー名 |
| `SLACK_WEBHOOK` | Slack 通知用 | Slack App（オプション） |

---

## ステップ 1: ConoHa側でSSH鍵をセットアップ

### 1-1. ConoHaサーバーでセットアップスクリプトを実行

```bash
cd ~/jomon-portal
bash scripts/setup-github-ssh.sh
```

このスクリプトが以下を自動実行：
- GitHub Actions デプロイ用 SSH キーペア生成
- 公開鍵を `~/.ssh/authorized_keys` に登録
- 秘密鍵の内容を表示

**重要：** スクリプト実行後に表示される**秘密鍵**の内容をコピーしてください。

### 1-2. 秘密鍵の確認（スクリプト実行後に表示されます）

```bash
# または、後で確認する場合：
cat ~/.ssh/jomon-deploy
```

出力例：
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2x8f9...（長い文字列）...
...
-----END RSA PRIVATE KEY-----
```

**この全文を GitHub Secrets に登録します。**

---

## ステップ 2: GitHub Secrets を登録

### 2-1. GitHub にログイン

1. https://github.com にアクセス
2. リポジトリ: https://github.com/ninjaburger1945-del/jomon-portal

### 2-2. Settings → Secrets and variables → Actions

1. リポジトリページ → **Settings** タブ
2. 左メニュー → **Secrets and variables** → **Actions**
3. **New repository secret** をクリック

### 2-3. 各 Secret を登録

#### Secret 1: CONOHA_SSH_KEY（最重要）

| 項目 | 値 |
|------|-----|
| **Name** | `CONOHA_SSH_KEY` |
| **Secret** | スクリプト実行後に表示された秘密鍵の**全文** |

⚠️ **重要注意事項：**
- `-----BEGIN RSA PRIVATE KEY-----` から `-----END RSA PRIVATE KEY-----` まで、**全て**をコピー
- 改行も含めてコピー
- 先頭・末尾の空白は削除しない

#### Secret 2: CONOHA_SERVER_IP

| 項目 | 値 |
|------|-----|
| **Name** | `CONOHA_SERVER_IP` |
| **Secret** | ConoHa サーバーの IP アドレス |

取得方法（ConoHaサーバー上）：
```bash
hostname -I | awk '{print $1}'
```

例：`210.xxx.xxx.xxx`

#### Secret 3: CONOHA_USER

| 項目 | 値 |
|------|-----|
| **Name** | `CONOHA_USER` |
| **Secret** | SSH ログインユーザー名 |

確認方法（ConoHaサーバー上）：
```bash
whoami
```

例：`root` または `username`

#### Secret 4: GOOGLE_GENERATIVE_AI_API_KEY

| 項目 | 値 |
|------|-----|
| **Name** | `GOOGLE_GENERATIVE_AI_API_KEY` |
| **Secret** | Gemini API キー |

#### Secret 5: GOOGLE_CUSTOM_SEARCH_API_KEY

| 項目 | 値 |
|------|-----|
| **Name** | `GOOGLE_CUSTOM_SEARCH_API_KEY` |
| **Secret** | Google Custom Search API キー |

#### Secret 6: GOOGLE_CUSTOM_SEARCH_ENGINE_ID

| 項目 | 値 |
|------|-----|
| **Name** | `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` |
| **Secret** | カスタム検索エンジンの ID |

#### Secret 7: SLACK_WEBHOOK（オプション）

| 項目 | 値 |
|------|-----|
| **Name** | `SLACK_WEBHOOK` |
| **Secret** | Slack Incoming Webhook URL |

---

## ステップ 3: ワークフロー実行テスト

### 3-1. 手動トリガーでテスト

1. GitHub → **Actions** タブ
2. **ConoHa Auto Deploy & Remaster** をクリック
3. **Run workflow** → **Run workflow** をクリック

### 3-2. ログで確認

ログで確認できること：
```
✓ Checkout code
✓ Setup Node.js
✓ Install dependencies
✓ Build
✓ Deploy to ConoHa
✓ Verify Deploy
```

### 3-3. ConoHa側で確認

```bash
pm2 status
pm2 logs jomon-web
```

---

## トラブルシューティング

### SSH 接続エラー: "Permission denied (publickey)"

**原因：** 秘密鍵が正しく登録されていない

**解決方法：**
1. 秘密鍵を確認（先頭と末尾に `-----BEGIN`/`-----END` があるか）
2. GitHub Secret を削除して再度登録
3. ConoHa側で以下を実行：
```bash
cat ~/.ssh/authorized_keys | grep jomon-deploy
```

### "Unknown host" エラー

**原因：** CONOHA_SERVER_IP が正しくない

**解決方法：**
1. ConoHa コントロールパネルで IP アドレスを確認
2. GitHub Secret を更新

---

## 完全チェックリスト

- [ ] ConoHa で `setup-github-ssh.sh` を実行
- [ ] 秘密鍵をコピー
- [ ] GitHub Secrets に登録（7項目）
- [ ] GitHub Actions で手動トリガーテスト
- [ ] デプロイ成功を確認

---

## セキュリティに関する注意

⚠️ **重要な注意事項：**

1. **秘密鍵は絶対に公開しない**
   - GitHub の Secret として安全に保管
   - ローカルで表示した秘密鍵は削除

2. **SSH キーのローテーション**
   - 定期的に新しいキーペアを生成（年1回推奨）

3. **GitHub Actions ログ**
   - 秘密情報は自動的にマスク
   - ログを第三者と共有しない
