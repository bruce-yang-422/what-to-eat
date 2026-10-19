# 今天吃什麼？

上班族的午餐／晚餐決定器。純靜態 PWA，可直接部署到 GitHub Pages，支援離線與加到主畫面。

**立即使用 Live demo → <https://eat.stack-base.com/>**

> 手機開啟後可「加到主畫面」，像 App 一樣使用。定位與開啟外送 App 等功能需透過上方 https 網址使用。

## 功能
- **兩種模式**
  - **食物類型**：從 160+ 種台灣日常外食裡抽「吃什麼」
  - **口袋餐廳**：從自己存的店裡抽「去哪家」
- **地點**：可新增／刪除（預設「公司附近」「家附近」）；選「目前位置」會向瀏覽器要求定位，自動對應 3 公里內最近的地點
- **新增餐廳**：貼上 Google 地圖分享內容自動帶入店名與位置，可標記可外送、備註
- **快速篩選**：時段、預算、口味（熱的／清淡／重口味／快速／有湯／飯／麵）、料理類型
- **避免重複**：最近 1／3／7 天吃過的先不抽；「再選一次」跳過的本次不再出現
- **結果後續**：導航／Google 地圖找附近店家、foodpanda、Uber Eats 外送、分享給同事；抽到食物時列出口袋名單裡的同類型餐廳
- **清單管理**：依類型分組，可整組開關、收合
- **吃飯紀錄**：本週統計、最常吃、支援復原
- **備份**：匯出／匯入 JSON
- 外觀：亮色（預設）／暗色／跟隨系統，在「設定」用膠囊開關切換
- iOS / Android 安裝提示、長按圖示快捷「立刻決定」

所有資料只存在瀏覽器 `localStorage`，無後端、無追蹤。

## 本機預覽
```bash
npx serve .
# 或
python -m http.server 8080
```
> Service Worker 和定位都需要透過 http(s) 或 localhost 開啟，不能直接雙擊 `index.html`。

## 部署到 GitHub Pages
1. 推送此資料夾到 GitHub repo
2. Settings → Pages → Source 選 `Deploy from a branch`，Branch 選 `main` / `(root)`
3. 開啟 `https://<帳號>.github.io/<repo>/`

所有路徑皆為相對路徑，放在子目錄也能正常運作。

## 更新版本
修改內容後，請將 `sw.js` 內的 `VERSION` 改成新值，使用者下次開啟即會取得新版。

## 自訂預設清單
編輯 [`js/data.js`](js/data.js)：
```js
{ id: 'f999', n: '名稱', e: '🍜', c: '中式', p: 1, t: ['hot','noodle'], m: 'LD' }
```
- `p`：1 銅板 / 2 平價 / 3 犒賞
- `t`：`hot` `light` `heavy` `fast` `soup` `rice` `noodle`
- `m`：`L` 午餐 `D` 晚餐 `N` 宵夜
