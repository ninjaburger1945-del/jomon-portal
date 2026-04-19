# Cloudflare Pages への移住ガイド

## ✅ 完了した準備作業

1. **自動実行の完全無効化**
   - GitHub Actions の cron schedules コメントアウト
   - `daily-crawler.js` と `collect-events.js` の git push 無効化

2. **次.js を Cloudflare Pages 対応に最適化**
   - `@cloudflare/next-on-pages` と `wrangler.toml` を導入
   - `next.config.ts` を Cloudflare 対応に修正
   - `package.json` の build スクリプトを更新

## 📋 Cloudflare Pages への移住手順

### ステップ1：Cloudflare アカウント設定
1. https://dash.cloudflare.com にアクセス
2. Pages セクションで "新しいプロジェクトを作成"
3. GitHub リポジトリを接続（ninjaburger1945-del/jomon-portal）

### ステップ2：ビルド設定
Cloudflare Pages のビルド設定で以下を入力：

| 項目 | 値 |
|------|-----|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 20.x |

### ステップ3：環境変数設定
Cloudflare Pages UI → Settings → Environment Variables で以下を追加：

```
GEMINI_API_KEY20261336 = [your-gemini-key]
NEXT_PUBLIC_GITHUB_TOKEN = [your-github-token]
NEXT_PUBLIC_GITHUB_REPO = ninjaburger1945-del/jomon-portal
GOOGLESEARCH_SERVICE_ACCOUNT = [json-service-account]
GOOGLESEARCH_CX = [your-cx-id]
```

### ステップ4：カスタムドメイン設定
1. Cloudflare Pages → jomon-portal → Custom domains
2. www.jomon-portal.jp を追加
3. DNS 設定を確認

### ステップ5：デプロイテスト
1. main ブランチに push
2. Cloudflare Pages が自動デプロイを開始
3. Deployments タブでログを確認

## 🔄 Vercel からの移行チェックリスト

- [ ] Cloudflare Pages デプロイが成功
- [ ] サイトが正常に動作（www.jomon-portal.jp にアクセス）
- [ ] API エンドポイントが動作（/api/facilities など）
- [ ] イメージ生成機能が動作
- [ ] GitHub 連携が正常に動作
- [ ] Vercel プロジェクトを Pause
- [ ] Vercel ドメイン設定を削除

## ⚠️ 注意事項

- **自動実行は無効化されています** - 必要に応じて手動で実行してください
- **ISR（Incremental Static Regeneration）は無効化されています** - 静的生成のみ使用
- **Cloudflare Workers は 30秒のタイムアウト制限あり** - 長時間実行は困難

## 🆘 トラブルシューティング

### ビルドエラー
```bash
npm run build
```
でローカルビルドをテスト

### デプロイ後に 502 エラー
- Cloudflare Pages ダッシュボードでログを確認
- Environment Variables が正しく設定されているか確認

### API が動作しない
- next-on-pages の互換性確認
- API ルートのコード確認

## 📚 参考リンク
- https://github.com/cloudflare/next-on-pages
- https://developers.cloudflare.com/pages/
- https://wrangler.cloudflare.com/
