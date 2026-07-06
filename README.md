# Kobo99

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white&style=flat-square)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white&style=flat-square)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-F38020?logo=cloudflare&logoColor=white&style=flat-square)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=githubactions&logoColor=white&style=flat-square)
![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?logo=claude&logoColor=white&style=flat-square)

Kobo 每週 99 元特價電子書彙整，一次比較讀墨、博客來、Goodreads、Amazon 等平台評分，快速找到值得入手的好書。

**Live demo：[kobo99.butitsbutter.dev](https://kobo99.butitsbutter.dev/)**

## 這是什麼

Kobo 每週會在部落格公布一份 99 元特價書單，但書單本身不附評價，得自己一本一本去其他平台查評分才知道值不值得買。這個專案把每週書單抓下來，自動到讀墨、博客來查中文版評分；若該書有原文版（例如英文原著的翻譯書），也會一併查 Goodreads、Amazon 的原文版評分一起納入比較，做成一個方便一次瀏覽比較的彙整頁。

起源於發現類似的彙整工具（[kobo99.com](https://kobo99.com/)）沒有完全符合我想要的資料呈現方式，於是動手做了自己的版本。

## 架構

純靜態、唯讀的 Jamstack，沒有後端、沒有 API server、沒有資料庫：

```
爬蟲（GitHub Actions 週排程）→ 產出 JSON → commit 進 repo → 前端 build 時讀取、SSG 產出靜態頁面
```

資料每週才變一次、而且全部要送到前端，本質上是「每週更新的靜態目錄」，加後端只會多出不必要的 runtime 依賴與維運成本。資料 JSON 直接 commit 進版控，也順手免費拿到「每週書單快照」的歷史時間軸。

## 設計取捨

- **反爬蟲分層策略**：不同平台的防護強度不同，個別商品頁大多在 Cloudflare/CloudFront 後面，一律用 Playwright（真實瀏覽器）繞過；搜尋/列表頁若裸抓打得通，就用 Cheerio 省開銷。先求跑得起來，再回頭省資源。
- **資料寧缺不猜**：這是評價彙整產品的信任基礎——書名配對信心不足就給 `null`，絕不 fallback 硬猜一個可能是錯的結果。評分欄位天生 nullable，顯示時誠實標示則數，稀疏就是稀疏。
- **多平台加權評分**：綜合評分不是單純平均，是用 `Σ(rating × count) / Σcount` 依各平台則數加權，避免只有 2 則評分的平台跟有幾千則評分的平台被等權重看待。
- **混合式排程**：GitHub Actions 的機房 IP 被部分平台的 CDN 封鎖，改用 Claude Code 的本機 Scheduled Tasks（住宅 IP）自動化執行週期性補抓，跟雲端排程透過「只填補 null 欄位、不覆蓋既有資料」的 merge 邏輯安全共存，全程不需要手動介入。

## Tech Stack

**前端**（`web/`）：React 19、Vite 8、TypeScript、Tailwind CSS v4、vite-react-ssg（build 時產出實內容 HTML）

**爬蟲**（`scraper/`）：TypeScript、Playwright + playwright-extra（stealth）、Cheerio、axios、bun

**部署**：Cloudflare Pages，資料更新由 GitHub Actions 週排程驅動

**排程**：GitHub Actions + Claude Code Scheduled Tasks

**開發協作**：Claude Code

## 本機開發

### 爬蟲

```bash
cd scraper
pnpm install
pnpm run scrape        # 抓當前 ISO 週；也可用 bun src/scrape.ts 直接跑
```

補抓歷史週次可帶環境變數：`TARGET_YEAR=2026 TARGET_WEEK=25 pnpm run scrape`

### 前端

```bash
cd web
pnpm install
pnpm run dev            # 開發伺服器
pnpm run build           # SSG build，產出 dist/
```

前端直接讀取 `../data/{年}-kobo99-deals.json`，不用另外複製資料檔。
