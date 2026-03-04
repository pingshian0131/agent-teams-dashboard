---
description: 發佈新版本到 npm。當用戶說「npm publish」、「發佈 npm」、「發新版」時觸發。
---

# npm publish 流程

## 步驟

1. **確認版本號**：詢問用戶要 bump 哪個版本（patch / minor / major），或由用戶指定版本號
2. **執行 bump**：`npm version <patch|minor|major> --no-git-tag-version`
3. **建置**：`npm run build && npm run build:server`
4. **檢查包內容**：`npm pack --dry-run`，確認檔案正確
5. **登入 npm**（如需要）：執行 `npm whoami`，若未登入則執行 `npm login`（會開瀏覽器用 Passkey 驗證，取得 2 小時 session token）
6. **發佈**：`npm publish`
7. **Git commit + tag + push**：
   ```bash
   git add package.json package-lock.json
   git commit -m "release: v<版本號>"
   git tag v<版本號>
   git push && git push --tags
   ```

## 注意事項

- npm 使用 session-based auth（2025/12 起），`npm login` 透過瀏覽器 Passkey 驗證，session 有效期 2 小時
- 不需要 OTP 或 authenticator app
- 發佈前一定要先跑 build 確認編譯成功
