# 今天吃什麼？

上班族的午餐／晚餐／宵夜決定器。純靜態 PWA，免下載、免註冊，支援離線與加到主畫面。

**立即使用 Live demo → <https://eat.stack-base.com/>**

> 手機開啟後可「加到主畫面」，像 App 一樣使用。定位功能需透過上方 https 網址使用。

## 功能

- **兩種模式**
  - **食物類型**：從 164 種台灣日常外食裡抽「吃什麼」
  - **口袋餐廳**：從自己存的店裡抽「去哪家」
- **快速篩選**：時段（午餐／晚餐／宵夜）、預算（月底／發薪／年終，不寫死金額；各店價差大的品項標成範圍，例如牛肉麵「發薪～年終」）、口味（熱的／清淡／重口味／快速／有湯／飯／麵）、料理類型
- **地點**：可新增／刪除（預設「公司附近」「家附近」）；選「目前位置」會向瀏覽器要求定位，自動對應 3 公里內最近的地點
- **新增餐廳**：貼上 Google 地圖分享內容，自動帶入店名與位置；可加備註、在店裡記下位置；圖示依名稱自動挑選
- **抽選結果**：Google 地圖找附近店家或導航、分享給同事（手機用系統分享，電腦直接複製）；抽到食物時列出口袋名單裡的同類型餐廳
- **避免重複**：最近 1／3／7 天吃過的先不抽；「再選一次」跳過的本次不再出現
- **清單管理**：食物先看類型總覽，點進某一類再開關個別品項；口袋餐廳以卡片顯示，可依地點、類型篩選
- **吃飯紀錄**：本週統計、近 30 天最常吃、刪除可復原
- **設定**：避免重複天數、外觀（亮色預設／暗色／跟隨系統）、地點管理、匯出／匯入 JSON 備份
- **介面**：手機優先、底部分頁（決定／清單／紀錄／設定）、主色取自 logo，文字對比皆達 WCAG AA
- **SEO**：canonical、Open Graph／Twitter 分享卡片（`icons/og-image.png`）、JSON-LD、`robots.txt`、`sitemap.xml`

所有資料只存在瀏覽器 `localStorage`，無後端、無追蹤。

## 檔案結構

```text
index.html            頁面與 SEO 標記
css/style.css         樣式（亮色／暗色色票在 :root）
js/data.js            預設食物資料
js/app.js             程式邏輯
sw.js                 Service Worker（離線快取）
manifest.webmanifest  PWA 設定
icons/                favicon、App 圖示、分享預覽圖
CNAME                 自訂網域 eat.stack-base.com
robots.txt / sitemap.xml
```

## 本機預覽

```bash
npx serve .
# 或
python -m http.server 8080
```

> Service Worker 和定位都需要透過 http(s) 或 localhost 開啟，不能直接雙擊 `index.html`。

## 部署

推送到 GitHub 的 `main` 分支後，GitHub Pages 會自動部署到 <https://eat.stack-base.com/>。

- 網域設定：DNS 以 CNAME 將 `eat` 指向 `bruce-yang-422.github.io`，repo 根目錄的 `CNAME` 檔記錄網域
- 所有路徑皆為相對路徑，改用 `https://<帳號>.github.io/<repo>/` 也能正常運作

## 更新網站

直接推送到 `main` 即可，不需要調整版本號。`sw.js` 一律「有網路抓最新、離線才用快取」，使用者下次開啟就是新版；`VERSION` 固定為 `wte-v1.0.0`。

## 自訂預設清單

編輯 [`js/data.js`](js/data.js)，依類型放進對應的區塊：

```js
{ id: 'f165', n: '名稱', e: '🍜', c: '中式', p: 1, t: ['hot', 'noodle'], m: 'LD' }
```

- `id`：`f` + 三位數流水號，依類型順序排列，新增從 `f165` 接續
- `n`：名稱　`e`：emoji（請用 Emoji 11／2018 年以前的，舊版 Windows 與手機才顯示得出來）
- `c`：類型，需為 `CATEGORIES` 其中之一
- `p`：價位等級 `1` 月底／`2` 發薪／`3` 年終，不對應固定金額；各店價差大的寫成範圍，例如 `[2, 3]`
- `t`：口味標籤 `hot` `light` `heavy` `fast` `soup` `rice` `noodle`
- `m`：時段 `L` 午餐 `D` 晚餐 `N` 宵夜
- `q`：（選填）地圖搜尋關鍵字，未填則用名稱
