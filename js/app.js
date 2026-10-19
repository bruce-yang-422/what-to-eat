/* 今天吃什麼 — app logic (vanilla JS, no build step) */
(() => {
  'use strict';

  // ---------- Helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (n) => Math.floor(Math.random() * n);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* noop */ } };
  const reflow = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const icon = (name, cls = '') => `<svg class="ic ${cls}"><use href="#i-${name}"/></svg>`;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const uid = (p) => `${p}${Date.now().toString(36)}${rand(1296).toString(36)}`;
  const DAY = 864e5;
  const WEEK = '日一二三四五六';
  const NEAR_M = 3000; // 「目前位置」對應地點／餐廳的距離上限

  // ---------- Constants ----------
  const KEY = 'wte:v1';
  const MEALS = { L: { label: '午餐' }, D: { label: '晚餐' }, N: { label: '宵夜' } };
  const BUDGETS = [
    { v: 0, label: '不限' },
    { v: 1, label: '省錢' },
    { v: 2, label: '適中' },
    { v: 3, label: '犒賞' },
    { v: 4, label: '奢華' },
    { v: 5, label: '極奢' },
  ];
  const MOODS = [
    ['hot', '熱的'], ['light', '清淡'], ['heavy', '重口味'], ['fast', '快速'],
    ['soup', '有湯'], ['rice', '飯'], ['noodle', '麵'],
  ];
  const TAG_LABEL = Object.fromEntries(MOODS);
  // 價位只分等級、不寫金額：同一道菜各店價差大，寫死金額容易誤導
  // p 可以是單一等級（2）或範圍（[2, 3]），例如牛肉麵一般店適中、名店到犒賞
  const PRICE = { 1: '省錢', 2: '適中', 3: '犒賞', 4: '奢華', 5: '極奢' };
  const tiers = (x) => [].concat(x.p);
  // 健康紅綠燈：依烹調方式（炸／炒煎勾芡／蒸煮燙涮）標記，參考成大美侖診所營養師「食物紅綠燈」
  const HEALTH = {
    g: { label: '綠燈', tip: '可以常吃' },
    y: { label: '黃燈', tip: '不宜天天吃' },
    r: { label: '紅燈', tip: '偶爾吃就好' },
  };
  const healthTitle = (x) => (HEALTH[x.h] ? `${HEALTH[x.h].label}・${x.hn}：${HEALTH[x.h].tip}` : '');
  const priceLabel = (x) => { const t = tiers(x); return t.length > 1 ? `${PRICE[t[0]]}～${PRICE[t[t.length - 1]]}` : PRICE[t[0]]; };
  // 圖示選單：內建清單用到的 emoji 優先，再補幾個常用的
  const EMOJI_PICKS = [...new Set(['🍽️', ...FOODS.map((f) => f.e), '🥢', '🍰', '🥤', '☕', '🍺'])];
  // 依名稱自動挑圖示：先比對內建清單的品名，再比對關鍵字，最後用類型預設
  const EMOJI_KEYWORDS = [
    ['便當', '🍱'], ['壽司', '🍣'], ['拉麵', '🍜'], ['咖哩', '🍛'], ['義大利', '🍝'], ['披薩', '🍕'], ['漢堡', '🍔'],
    ['三明治', '🥪'], ['吐司', '🍞'], ['麵包', '🥐'], ['貝果', '🥯'], ['早餐', '🍳'], ['蛋餅', '🍳'], ['蘿蔔糕', '🥞'], ['早午餐', '🥞'], ['沙拉', '🥗'],
    ['牛排', '🥩'], ['燒肉', '🥩'], ['烤肉', '🥓'], ['鍋', '🍲'], ['湯', '🍲'], ['粥', '🥣'], ['餃', '🥟'], ['包子', '🥟'],
    ['飯糰', '🍙'], ['丼', '🍚'], ['飯', '🍚'], ['麵', '🍜'], ['粉', '🍜'], ['雞', '🍗'], ['炸', '🍗'], ['串', '🍢'], ['滷', '🍢'],
    ['蝦', '🍤'], ['魚', '🐟'], ['蛋', '🍳'], ['辣', '🌶️'], ['咖啡', '☕'], ['茶', '🥤'], ['飲', '🥤'], ['甜', '🍰'], ['酒', '🍺'], ['居酒屋', '🏮'],
  ];
  const CAT_EMOJI = { 中式: '🥢', 小吃: '🍢', 早餐店: '🍳', 日式: '🍣', 韓式: '🥘', 東南亞: '🍛', 西式: '🍝', 火鍋: '🍲', 速食: '🍔', 超商: '🍙', 輕食: '🥗', 素食: '🥬', 點心代餐: '🥤' };

  function guessEmoji(name, cat) {
    const n = name.trim();
    if (n) {
      const hit = FOODS.filter((f) => f.n.length >= 2 && n.includes(f.n)).sort((a, b) => b.n.length - a.n.length)[0];
      if (hit) return hit.e;
      const kw = EMOJI_KEYWORDS.filter(([k]) => n.includes(k)).sort((a, b) => b[0].length - a[0].length)[0];
      if (kw) return kw[1];
    }
    return CAT_EMOJI[cat] || '🍽️';
  }
  const DEFAULT_PLACES = () => [{ id: 'p-work', name: '公司附近' }, { id: 'p-home', name: '家附近' }];

  // ---------- State ----------
  const defaults = () => ({
    disabled: [], custom: [], history: [],
    restaurants: [], places: DEFAULT_PLACES(),
    mode: 'type', place: '__here',
    settings: { avoidDays: 3, look: 'light' }, // look：light 亮色（預設）/ dark 暗色 / auto 跟隨系統
    filters: { budget: 0, moods: [], cats: [], health: '' }, // health：'' 不限／noRed 避開紅燈／green 只要綠燈
  });

  function load() {
    const d = defaults();
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, filters: { ...d.filters, ...(s.filters || {}) } };
    } catch (e) { return d; }
  }
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* quota / private mode */ } };

  let meal = autoMeal();
  let mealManual = false;
  let current = null;
  let confirmed = false;
  let spinning = false;
  let view = 'decide';
  const skipped = new Set(); // 本次使用中按「再選一次」略過的

  function autoMeal(d = new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 4.5 && h < 15) return 'L';
    if (h >= 15 && h < 21.5) return 'D';
    return 'N';
  }

  const isPocket = () => S.mode === 'pocket';
  const allFoods = () => FOODS.concat(S.custom);
  const placeById = (id) => S.places.find((p) => p.id === id);

  // ---------- Geolocation ----------
  const here = { status: 'idle', lat: null, lng: null, ts: 0 }; // idle | locating | ok | denied | unavailable

  function distance(a, b) {
    const R = 6371e3, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const hasXY = (o) => o && typeof o.lat === 'number' && typeof o.lng === 'number';
  const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} 公尺` : `${(m / 1000).toFixed(1)} 公里`);

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) { reject(new Error('unsupported')); return; }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60e3 }
      );
    });
  }

  async function locate(force = false) {
    if (here.status === 'locating') return;
    if (!force && here.status === 'ok' && Date.now() - here.ts < 5 * 60e3) return;
    here.status = 'locating';
    renderPlaces();
    try {
      const p = await getPosition();
      Object.assign(here, p, { status: 'ok', ts: Date.now() });
    } catch (e) {
      here.status = e && e.code === 1 ? 'denied' : 'unavailable';
    }
    renderPlaces();
    updateCount();
  }

  // 「目前位置」對應到的已存地點（3 公里內最近的）
  function nearestPlace() {
    if (here.status !== 'ok') return null;
    let best = null;
    S.places.filter(hasXY).forEach((p) => {
      const d = distance(here, p);
      if (d <= NEAR_M && (!best || d < best.d)) best = { place: p, d };
    });
    return best;
  }

  // ---------- Pools ----------
  function matches(x) {
    const f = S.filters;
    return x.m.includes(meal) &&
      (!f.budget || tiers(x).includes(f.budget)) &&
      f.moods.every((t) => x.t.includes(t)) &&
      (!f.cats.length || f.cats.includes(x.c)) &&
      // 沒有燈號的（口袋餐廳、自訂食物）不受健康篩選影響
      (!f.health || !x.h || (f.health === 'green' ? x.h === 'g' : x.h !== 'r'));
  }

  function inPlace(r) {
    if (S.place !== '__here') return r.place === S.place;
    if (here.status !== 'ok') return true; // 無法定位：從全部口袋名單抽
    const near = nearestPlace();
    return (near && r.place === near.place.id) || (hasXY(r) && distance(here, r) <= NEAR_M);
  }

  function basePool() {
    const dis = new Set(S.disabled);
    if (isPocket()) return S.restaurants.filter((r) => !dis.has(r.id) && matches(r) && inPlace(r));
    return allFoods().filter((x) => !dis.has(x.id) && matches(x));
  }

  function pickPool() {
    const base = basePool();
    let p = base.filter((x) => !skipped.has(x.id));
    if (!p.length && base.length) {
      skipped.clear();
      p = base;
      toast('全部看過一輪了，重新開始');
    }
    const days = S.settings.avoidDays;
    if (days) {
      const since = Date.now() - days * DAY;
      const recent = new Set(S.history.filter((h) => h.ts >= since).map((h) => h.id));
      const fresh = p.filter((x) => !recent.has(x.id));
      if (fresh.length) p = fresh;
    }
    if (current && p.length > 1) p = p.filter((x) => x.id !== current.id);
    return p;
  }

  // ---------- Theme ----------
  const LOOK_LABEL = { light: '亮色', dark: '暗色', auto: '跟隨系統' };
  function applyTheme() {
    const t = LOOK_LABEL[S.settings.look] ? S.settings.look : 'light';
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    requestAnimationFrame(() => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      $('meta[name="theme-color"]').setAttribute('content', bg || '#fbf7f3');
    });
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, actionLabel, onAction) {
    const el = $('#toast');
    const btn = $('#toastAction');
    $('#toastText').textContent = msg;
    if (actionLabel) {
      btn.hidden = false;
      btn.textContent = actionLabel;
      btn.onclick = () => { onAction && onAction(); hideToast(); };
    } else {
      btn.hidden = true;
      btn.onclick = null;
    }
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, actionLabel ? 4500 : 2400);
  }
  const hideToast = () => $('#toast').classList.remove('show');

  // ---------- Decide: header / filters ----------
  const chip = (label, attrs, pressed, cls = '') =>
    `<button class="chip ${cls}" type="button" ${attrs} aria-pressed="${pressed}">${label}</button>`;

  function renderMeal() {
    $$('#mealSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.meal === meal)));
    $('#filterTitle').textContent = `今天${MEALS[meal].label}想吃什麼？`;
  }

  function renderFilters() {
    $('#budgetChips').innerHTML = BUDGETS.map((b) => chip(b.label, `data-budget="${b.v}"`, false)).join('');
    $('#moodChips').innerHTML = MOODS.map(([k, l]) => chip(l, `data-mood="${k}"`, false)).join('');
    $('#catChips').innerHTML = chip('全部', 'data-cat=""', false) + CATEGORIES.map((c) => chip(c, `data-cat="${c}"`, false)).join('');
    syncFilters();
  }

  function syncFilters() {
    const f = S.filters;
    $$('#budgetChips .chip').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.budget === f.budget)));
    $$('#moodChips .chip').forEach((b) => b.setAttribute('aria-pressed', String(f.moods.includes(b.dataset.mood))));
    $$('#catChips .chip').forEach((b) => {
      const c = b.dataset.cat;
      b.setAttribute('aria-pressed', String(c ? f.cats.includes(c) : f.cats.length === 0));
    });
    $$('#healthChips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.health === (f.health || ''))));
    const d = S.settings.avoidDays;
    $('#avoidText').textContent = d ? `避開最近 ${d} 天吃過` : '不避開最近吃過的';
    updateCount();
  }

  function updateCount() {
    const n = basePool().length;
    const f = S.filters;
    const pocketEmpty = isPocket() && !S.restaurants.length;
    $('#btnReset').hidden = !(f.budget || f.moods.length || f.cats.length || f.health);
    $('#poolCount').innerHTML = pocketEmpty
      ? '把常去的店存起來，之後就能從裡面抽'
      : `符合條件 <b>${n}</b> ${isPocket() ? '家' : '個選項'}`;
    if (!spinning) {
      // 口袋名單是空的：大按鈕直接帶去新增
      $('#btnSpin').disabled = n === 0 && !pocketEmpty;
      $('#btnSpinLabel').textContent = pocketEmpty ? '新增第一家口袋餐廳' : (n === 0 ? '沒有符合的選項' : '立刻決定');
    }
  }

  const toggleIn = (arr, v) => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); };

  $('#view-decide').addEventListener('click', (e) => {
    const t = e.target;
    const bud = t.closest('[data-budget]');
    const md = t.closest('[data-mood]');
    const ct = t.closest('#catChips [data-cat]');
    const hc = t.closest('[data-health]');
    if (bud || md || ct || hc) {
      const f = S.filters;
      if (hc) f.health = hc.dataset.health;
      else if (bud) f.budget = +bud.dataset.budget;
      else if (md) toggleIn(f.moods, md.dataset.mood);
      else {
        const c = ct.dataset.cat;
        if (!c) f.cats = [];
        else { toggleIn(f.cats, c); if (f.cats.length === CATEGORIES.length) f.cats = []; }
      }
      buzz(6);
      save();
      syncFilters();
      return;
    }
    if (t.closest('#btnReset')) {
      S.filters = defaults().filters;
      save();
      syncFilters();
      toast('條件已重設');
      return;
    }
    if (t.closest('[data-relocate]')) { locate(true); return; }
    if (t.closest('[data-save-here]')) { saveHereAsPlace(); }
  });

  $('#mealSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-meal]');
    if (!b || b.dataset.meal === meal) return;
    meal = b.dataset.meal;
    mealManual = true;
    buzz(6);
    renderMeal();
    updateCount();
  });

  // ---------- Mode / places ----------
  function setMode(m) {
    S.mode = m;
    save();
    skipped.clear();
    renderMode();
    if (m === 'pocket' && S.place === '__here') locate();
  }

  function renderMode() {
    $$('#modeTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === S.mode)));
    $('#placeBlock').hidden = !isPocket();
    $('#healthGroup').hidden = isPocket(); // 口袋餐廳沒有燈號
    renderPlaces();
    updateCount();
  }

  $('#modeTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b || b.dataset.mode === S.mode) return;
    buzz(6);
    setMode(b.dataset.mode);
  });

  function renderPlaces() {
    if (S.place !== '__here' && !placeById(S.place)) S.place = '__here';
    const hereLabel = here.status === 'locating' ? '目前位置（定位中…）' : '目前位置';
    $('#placeSelect').innerHTML =
      `<option value="__here">${hereLabel}</option>` +
      S.places.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('') +
      '<option value="__manage">管理地點…</option>';
    $('#placeSelect').value = S.place;

    const st = $('#placeStatus');
    if (S.place !== '__here') {
      const n = S.restaurants.filter((r) => r.place === S.place).length;
      st.textContent = `「${placeById(S.place).name}」有 ${n} 家口袋餐廳`;
      return;
    }
    const near = nearestPlace();
    const map = {
      idle: '按右邊的定位按鈕取得目前位置',
      locating: '正在取得你的位置，瀏覽器可能會詢問是否允許…',
      denied: '沒有位置權限，先從全部口袋名單抽。可到瀏覽器設定允許後 <button class="text-btn" type="button" data-relocate>重試</button>',
      unavailable: '暫時無法定位，先從全部口袋名單抽。<button class="text-btn" type="button" data-relocate>重試</button>',
    };
    if (here.status !== 'ok') { st.innerHTML = map[here.status]; return; }
    st.innerHTML = near
      ? `已定位，靠近「${esc(near.place.name)}」（${fmtDist(near.d)}），也包含 3 公里內有記下位置的店`
      : '附近 3 公里內沒有存過的地點 · <button class="text-btn" type="button" data-save-here>把這裡存成新地點</button>';
  }

  $('#placeSelect').addEventListener('change', (e) => {
    const id = e.target.value;
    if (id === '__manage') { e.target.value = S.place; switchView('settings'); setTimeout(() => $('#placesCard').scrollIntoView({ behavior: 'smooth' }), 60); return; }
    S.place = id;
    save();
    buzz(6);
    if (id === '__here') locate(true);
    renderPlaces();
    updateCount();
  });
  $('#btnLocate').addEventListener('click', () => {
    S.place = '__here';
    save();
    locate(true);
  });

  async function saveHereAsPlace(name) {
    if (here.status !== 'ok') { await locate(true); if (here.status !== 'ok') { toast('無法取得位置'); return null; } }
    const n = (name || prompt('幫這個地點取個名字', '新地點') || '').trim();
    if (!n) return null;
    const p = { id: uid('p'), name: n.slice(0, 12), lat: here.lat, lng: here.lng };
    S.places.push(p);
    save();
    renderPlaces();
    renderPlaceList();
    updateCount();
    toast(`已新增地點「${p.name}」`);
    return p;
  }

  function goAddRestaurant() {
    listKind = 'rest';
    switchView('list');
    openSheet('rest');
  }
  function goRestList() {
    listKind = 'rest';
    listCat = '';
    switchView('list');
  }

  // ---------- Result ----------
  const heroEl = $('#hero');

  function renderResult(x) {
    const rest = x.kind === 'rest';
    $('#resultName').textContent = x.n;
    const place = rest && placeById(x.place);
    $('#resultCat').textContent = x.c;
    $('#resultLine').textContent = rest ? '今天就去這家。' : '今天就吃這個。';
    const notes = [];
    if (rest && place) notes.push(place.name);
    if (rest && hasXY(x) && here.status === 'ok') notes.push(`距離約 ${fmtDist(distance(here, x))}`);
    if (rest && x.note) notes.push(x.note);
    $('#resultNote').hidden = !notes.length;
    $('#resultNote').textContent = notes.join(' · ');
    const hl = $('#resultHealth');
    hl.hidden = !HEALTH[x.h];
    if (HEALTH[x.h]) hl.innerHTML = `<i class="hdot h-${x.h}"></i><span><b>${HEALTH[x.h].label}</b>・${esc(x.hn)}，${HEALTH[x.h].tip}</span>`;
    $('#resultPrice').textContent = priceLabel(x);
    const tags = x.t.filter((t) => ['soup', 'hot', 'light', 'heavy', 'fast'].includes(t)).slice(0, 2).map((t) => TAG_LABEL[t]);
    $('#resultTags').textContent = tags.length ? tags.join('・') : x.m.split('').map((k) => MEALS[k].label).join('・');

    // 導航 / 附近找店
    const q = rest ? x.n : (x.q || x.n);
    let mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    if (rest && x.url) mapUrl = x.url;
    else if (rest && hasXY(x)) mapUrl = `https://www.google.com/maps/search/?api=1&query=${x.lat},${x.lng}`;
    $('#btnMap').href = mapUrl;
    $('#btnMapLabel').textContent = rest ? 'Google 地圖導航' : 'Google 地圖';
    $('#linksTitle').textContent = rest ? '怎麼去' : '附近找店家';

    // 類型模式：列出同類型的口袋餐廳
    const card = $('#pocketCard');
    card.hidden = rest;
    if (!rest) {
      const dis = new Set(S.disabled);
      const same = S.restaurants.filter((r) => r.c === x.c && !dis.has(r.id) && r.m.includes(meal));
      $('#pocketRows').innerHTML = same.length
        ? same.slice(0, 3).map((r) => `<button class="link-row" type="button" data-pick-rest="${esc(r.id)}">
            <span class="row-emoji">${esc(r.e)}</span><span>${esc(r.n)}</span><svg class="ic chev"><use href="#i-chevron"/></svg></button>`).join('')
        : `<div class="pocket-empty">${S.restaurants.length ? `還沒有存過${esc(x.c)}的口袋餐廳` : '還沒有口袋餐廳'} · <button class="text-btn" type="button" data-go-add>新增</button></div>`;
    }
    updateConfirm();
  }

  function updateConfirm() {
    $('#btnConfirm').disabled = confirmed;
    $('#btnConfirmLabel').textContent = confirmed ? '已記錄' : '記錄這餐';
  }

  async function spin() {
    if (spinning) return;
    if (isPocket() && !S.restaurants.length) { goAddRestaurant(); return; }
    if (current && !confirmed) skipped.add(current.id);
    const pool = pickPool();
    if (!pool.length) {
      toast('沒有符合條件的選項，放寬條件試試');
      return;
    }
    const pick = pool[rand(pool.length)];
    const all = basePool();
    const visual = all.length > 1 ? all : pool;

    spinning = true;
    confirmed = false;
    current = null;
    switchView('result');
    $('#btnAgain').disabled = true;
    heroEl.classList.add('is-shuffling');
    $('#resultLine').textContent = '幫你挑選中…';
    $('#resultNote').hidden = true;
    $('#resultHealth').hidden = true;

    const N = reduceMotion() ? 1 : 12;
    for (let i = 0; i < N; i++) {
      const v = visual[rand(visual.length)];
      $('#resultName').textContent = v.n;
      $('#resultCat').textContent = v.c;
      await sleep(45 + Math.pow(i / N, 2.4) * 160);
    }
    heroEl.classList.remove('is-shuffling');
    current = pick;
    spinning = false;
    $('#btnAgain').disabled = false;
    renderResult(pick);
    reflow(heroEl, 'hero');
    updateCount();
    buzz([12, 40, 20]);
  }

  function confirmPick() {
    if (!current || confirmed) return;
    const entry = { id: current.id, n: current.n, e: current.e, m: meal, ts: Date.now() };
    if (current.kind === 'rest') { entry.r = 1; const p = placeById(current.place); if (p) entry.pl = p.name; }
    S.history.unshift(entry);
    S.history = S.history.slice(0, 500);
    save();
    confirmed = true;
    updateConfirm();
    buzz(20);
    toast(`已記錄「${current.n}」，吃飯愉快`, '復原', () => {
      S.history = S.history.filter((h) => h !== entry);
      save();
      confirmed = false;
      if (current) updateConfirm();
    });
  }

  async function share() {
    if (!current) return;
    const text = current.kind === 'rest'
      ? `${MEALS[meal].label}去「${current.n}」吧！要一起嗎？`
      : `${MEALS[meal].label}就吃「${current.n}」吧！要一起嗎？`;
    const url = location.href.split(/[?#]/)[0];
    // 只在手機用系統分享選單；電腦版的分享視窗不會帶文字，直接複製比較實用
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: '今天吃什麼？', text, url }); } catch (e) { /* cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('已複製，貼給同事吧');
    } catch (e) {
      toast(text);
    }
  }

  $('#btnSpin').addEventListener('click', spin);
  $('#btnAgain').addEventListener('click', spin);
  $('#btnConfirm').addEventListener('click', confirmPick);
  $('#btnShare').addEventListener('click', share);
  $('#btnBack').addEventListener('click', () => switchView('decide'));
  $('#pocketCard').addEventListener('click', (e) => {
    if (e.target.closest('[data-goto-rest]')) { goRestList(); return; }
    if (e.target.closest('[data-go-add]')) { goAddRestaurant(); return; }
    const b = e.target.closest('[data-pick-rest]');
    if (!b) return;
    const r = S.restaurants.find((x) => x.id === b.dataset.pickRest);
    if (!r) return;
    S.mode = 'pocket';
    save();
    renderMode();
    current = r;
    confirmed = false;
    renderResult(r);
    reflow(heroEl, 'hero');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---------- Views ----------
  function switchView(name) {
    if (name === view) { window.scrollTo({ top: 0, behavior: 'smooth' }); if (name === 'list') renderList(); return; }
    view = name;
    document.body.dataset.view = name;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
    const tabName = name === 'result' ? 'decide' : name;
    $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === tabName)));
    placeChrome();
    window.scrollTo(0, 0);
    if (name === 'list') renderList();
    if (name === 'history') renderHistory();
    if (name === 'settings') renderSettings();
    if (name === 'decide') { renderPlaces(); updateCount(); }
    hideToast();
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    buzz(5);
    if (t.dataset.view === 'list' && view !== 'list') { listKind = isPocket() ? 'rest' : 'food'; listCat = ''; }
    // 在結果頁按「決定」回到條件頁
    switchView(t.dataset.view === 'decide' && view === 'decide' ? 'decide' : t.dataset.view);
  }));
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) switchView(g.dataset.goto);
  });

  // ---------- List view ----------
  // 食物清單分兩層：類型總覽（格子）→ 點進某一類才列出品項；有搜尋字時直接列結果
  let listKind = 'food'; // food | rest
  let listCat = ''; // 食物：目前點進的類型（'' = 總覽、'__custom' = 自訂）；餐廳：篩選標籤
  let listPlace = '';
  let listQuery = '';

  const listSource = () => (listKind === 'rest' ? S.restaurants : allFoods());
  const inCat = (x, c) => (c === '__custom' ? x.custom : x.c === c);
  const catLabel = (c) => (c === '__custom' ? '自訂' : c);

  function renderListCats() {
    const cats = CATEGORIES.filter((c) => S.restaurants.some((x) => x.c === c));
    $('#listCats').innerHTML = chip('全部', 'data-lcat=""', !listCat) +
      cats.map((c) => chip(c, `data-lcat="${c}"`, listCat === c)).join('');
  }

  function visibleList() {
    const q = listQuery.trim().toLowerCase();
    return listSource().filter((x) =>
      (!listCat || inCat(x, listCat)) &&
      (listKind !== 'rest' || !listPlace || (listPlace === '__none' ? !x.place : x.place === listPlace)) &&
      (!q || x.n.toLowerCase().includes(q) || x.c.includes(q) || (x.note || '').toLowerCase().includes(q))
    );
  }

  function rowHTML(x, dis, showCat) {
    const on = !dis.has(x.id);
    const meals = x.m.split('').map((k) => MEALS[k]?.label).filter(Boolean).join('/');
    const sub = [showCat ? x.c : '', priceLabel(x), meals, ...x.t.slice(0, 2).map((t) => TAG_LABEL[t])].filter(Boolean).join(' · ');
    return `<li class="row${on ? '' : ' is-off'}" data-id="${esc(x.id)}">
      <span class="row-emoji">${esc(x.e)}</span>
      <div class="row-main">
        <div class="row-name">${esc(x.n)}${HEALTH[x.h] ? `<i class="hdot h-${x.h}" title="${esc(healthTitle(x))}" aria-label="${esc(healthTitle(x))}"></i>` : ''}${x.custom ? '<span class="badge">自訂</span>' : ''}</div>
        <div class="row-sub">${esc(sub)}</div>
      </div>
      ${x.custom ? `<button class="icon-btn" type="button" data-edit aria-label="編輯 ${esc(x.n)}">${icon('more')}</button>` : ''}
      <label class="switch" aria-label="啟用 ${esc(x.n)}"><input type="checkbox" data-toggle ${on ? 'checked' : ''}><span></span></label>
    </li>`;
  }

  function tileHTML(c, list, dis) {
    const on = list.filter((x) => !dis.has(x.id)).length;
    const pct = Math.round((on / list.length) * 100);
    const em = c === '__custom' ? '⭐' : CAT_EMOJI[c];
    return `<button class="ctile${on ? '' : ' is-off'}" type="button" data-open-cat="${esc(c)}">
      <span class="ct-emoji">${em}</span>
      <span class="ct-main"><span class="ct-name">${esc(catLabel(c))}</span>
        <span class="ct-count">${on === list.length ? `全部 ${list.length} 項` : `${on} / ${list.length} 項`}</span></span>
      <span class="ct-bar"><i style="width:${pct}%"></i></span>
    </button>`;
  }

  function drillHeadHTML(c, list, dis) {
    const on = list.filter((x) => !dis.has(x.id)).length;
    return `<div class="drill-head">
      <button class="icon-btn" type="button" data-back-cats aria-label="回到類型總覽">${icon('back')}</button>
      <div class="drill-main"><div class="drill-title serif">${esc(catLabel(c))}</div><div class="drill-sub">已啟用 ${on} / ${list.length}</div></div>
      <button class="chip small" type="button" data-gset="${on ? 0 : 1}">${on ? '全部關閉' : '全部開啟'}</button>
    </div>`;
  }

  function rcardHTML(r, dis) {
    const on = !dis.has(r.id);
    const place = placeById(r.place);
    const sub = [r.c, priceLabel(r), place ? place.name : '', r.note].filter(Boolean).join(' · ');
    return `<div class="rcard${on ? '' : ' is-off'}" data-id="${esc(r.id)}">
      <span class="rc-icon">${esc(r.e)}</span>
      <div class="rc-main"><div class="rc-name">${esc(r.n)}</div><div class="rc-sub">${esc(sub)}</div></div>
      <button class="icon-btn rc-mark" type="button" data-rtoggle aria-pressed="${on}" aria-label="${on ? '暫停抽選' : '加入抽選'} ${esc(r.n)}">${icon('bookmark')}</button>
      <button class="icon-btn" type="button" data-edit aria-label="編輯 ${esc(r.n)}">${icon('more')}</button>
    </div>`;
  }

  function renderList() {
    const rest = listKind === 'rest';
    const searching = !!listQuery.trim();
    $$('#listTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.list === listKind)));
    $('#listPlaceBar').hidden = !rest || !S.restaurants.length;
    if (rest) {
      if (listPlace && listPlace !== '__none' && !placeById(listPlace)) listPlace = '';
      $('#listPlace').innerHTML = '<option value="">全部地點</option>' +
        S.places.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('') +
        '<option value="__none">未指定地點</option>';
      $('#listPlace').value = listPlace;
      renderListCats();
    }
    $('#listCats').hidden = !rest || !S.restaurants.length;
    $('#healthLegend').hidden = rest;
    $('#btnAddLabel').textContent = rest ? '新增餐廳' : '新增食物';
    $('#listSearch').placeholder = rest ? '搜尋餐廳名稱…' : '搜尋食物…';

    const dis = new Set(S.disabled);
    const all = listSource();
    const onCount = all.filter((x) => !dis.has(x.id)).length;
    $('#listStat').textContent = rest ? '常去的店，從這裡抽' : '關掉不想吃的，就不會被抽到';
    $('#listCount').textContent = rest ? `已收藏 ${all.length} 家店` : `已啟用 ${onCount} / ${all.length} 項`;

    const box = $('#foodList');
    $('#listTools').hidden = true;
    let items;
    if (rest) {
      items = visibleList();
      box.className = 'rcards';
      box.innerHTML = items.map((r) => rcardHTML(r, dis)).join('');
    } else if (searching) {
      // 搜尋：跨類型平鋪
      items = visibleList();
      box.className = 'groups';
      box.innerHTML = `<ul class="list">${items.map((x) => rowHTML(x, dis, true)).join('')}</ul>`;
      $('#listTools').hidden = !items.length;
    } else if (listCat) {
      // 第二層：單一類型
      items = all.filter((x) => inCat(x, listCat));
      box.className = 'groups';
      box.innerHTML = drillHeadHTML(listCat, items, dis) + `<ul class="list">${items.map((x) => rowHTML(x, dis)).join('')}</ul>`;
    } else {
      // 第一層：類型總覽
      const cats = (S.custom.length ? ['__custom'] : []).concat(CATEGORIES);
      const tiles = cats.map((c) => [c, all.filter((x) => inCat(x, c))]).filter(([, l]) => l.length);
      items = all;
      box.className = 'ctiles';
      box.innerHTML = tiles.map(([c, l]) => tileHTML(c, l, dis)).join('');
    }
    box.hidden = !items.length;
    const empty = $('#listEmpty');
    empty.hidden = !!items.length;
    empty.innerHTML = rest && !S.restaurants.length
      ? '還沒有口袋餐廳<br><small>把常去的店存起來，之後就能從裡面抽</small>'
      : '找不到符合的項目';
  }

  $('#listTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-list]');
    if (!b || b.dataset.list === listKind) return;
    listKind = b.dataset.list;
    listCat = '';
    buzz(5);
    renderList();
  });
  $('#listPlace').addEventListener('change', (e) => { listPlace = e.target.value; renderList(); });
  $('#listSearch').addEventListener('input', (e) => { listQuery = e.target.value; renderList(); });
  $('#listCats').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    listCat = b.dataset.lcat;
    buzz(5);
    renderList();
  });

  function setEnabled(id, on) {
    const set = new Set(S.disabled);
    on ? set.delete(id) : set.add(id);
    S.disabled = [...set];
    save();
    updateCount();
  }

  // 切換單筆後只更新數字，不整個重畫（避免畫面跳動）
  function refreshCounts() {
    const dis = new Set(S.disabled);
    const all = allFoods();
    $('#listCount').textContent = `已啟用 ${all.filter((x) => !dis.has(x.id)).length} / ${all.length} 項`;
    const head = $('.drill-head');
    if (head && listCat) {
      const list = all.filter((x) => inCat(x, listCat));
      const on = list.filter((x) => !dis.has(x.id)).length;
      $('.drill-sub', head).textContent = `已啟用 ${on} / ${list.length}`;
      const b = $('[data-gset]', head);
      b.dataset.gset = on ? '0' : '1';
      b.textContent = on ? '全部關閉' : '全部開啟';
    }
  }

  $('#foodList').addEventListener('change', (e) => {
    const inp = e.target.closest('[data-toggle]');
    if (!inp) return;
    const row = inp.closest('.row');
    setEnabled(row.dataset.id, inp.checked);
    row.classList.toggle('is-off', !inp.checked);
    refreshCounts();
    buzz(6);
  });

  $('#foodList').addEventListener('click', (e) => {
    const open = e.target.closest('[data-open-cat]');
    if (open) {
      listCat = open.dataset.openCat;
      buzz(5);
      renderList();
      window.scrollTo(0, 0);
      return;
    }
    if (e.target.closest('[data-back-cats]')) {
      listCat = '';
      renderList();
      return;
    }
    const gb = e.target.closest('[data-gset]');
    if (gb) { bulkSet(gb.dataset.gset === '1'); return; }
    const item = e.target.closest('.row, .rcard');
    if (!item) return;
    const x = listSource().find((i) => i.id === item.dataset.id);
    if (e.target.closest('[data-rtoggle]')) {
      const on = item.classList.contains('is-off');
      setEnabled(item.dataset.id, on);
      buzz(6);
      renderList();
      toast(on ? `「${x.n}」已加入抽選` : `「${x.n}」暫停抽選`);
      return;
    }
    if (e.target.closest('[data-edit]') || item.classList.contains('rcard')) {
      if (x) openSheet(listKind, x);
      return;
    }
    if (e.target.closest('.switch')) return;
    const inp = item.querySelector('[data-toggle]');
    inp.checked = !inp.checked;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });

  function bulkSet(on) {
    const ids = (listKind === 'food' && listCat && !listQuery.trim()
      ? allFoods().filter((x) => inCat(x, listCat))
      : visibleList()).map((x) => x.id);
    const set = new Set(S.disabled);
    ids.forEach((id) => (on ? set.delete(id) : set.add(id)));
    S.disabled = [...set];
    save();
    renderList();
    updateCount();
    buzz(6);
    toast(on ? `已開啟 ${ids.length} 項` : `已關閉 ${ids.length} 項`);
  }
  $('#btnAllOn').addEventListener('click', () => bulkSet(true));
  $('#btnAllOff').addEventListener('click', () => bulkSet(false));

  // ---------- Settings view ----------
  function renderSettings() {
    $$('#avoidSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.avoid === S.settings.avoidDays)));
    const look = LOOK_LABEL[S.settings.look] ? S.settings.look : 'light';
    $('#themeSeg').dataset.value = look;
    $$('#themeSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.look === look)));
    $('#lookDesc').textContent = LOOK_LABEL[look];
    renderPlaceList();
  }

  function renderPlaceList() {
    $('#placeList').innerHTML = S.places.map((p) => {
      const n = S.restaurants.filter((r) => r.place === p.id).length;
      return `<li class="place-row" data-pid="${esc(p.id)}">
        ${icon('pin')}
        <div class="place-main"><div class="place-name">${esc(p.name)}</div>
          <div class="place-sub">${n} 家餐廳 · ${hasXY(p) ? '已設定位置' : '尚未設定位置'}</div></div>
        <button class="text-btn" type="button" data-pset>${hasXY(p) ? '更新為目前位置' : '設為目前位置'}</button>
        <button class="icon-btn" type="button" data-pdel aria-label="刪除 ${esc(p.name)}">${icon('trash')}</button>
      </li>`;
    }).join('') || '<li class="place-row"><span class="place-sub">還沒有地點</span></li>';
  }

  $('#avoidSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    S.settings.avoidDays = +b.dataset.avoid;
    save();
    buzz(5);
    renderSettings();
    syncFilters();
  });

  $('#themeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-look]');
    if (!b) return;
    S.settings.look = b.dataset.look;
    save();
    applyTheme();
    buzz(5);
    renderSettings();
  });

  $('#placeList').addEventListener('click', async (e) => {
    const row = e.target.closest('.place-row');
    if (!row || !row.dataset.pid) return;
    const p = placeById(row.dataset.pid);
    if (!p) return;
    if (e.target.closest('[data-pset]')) {
      await locate(true);
      if (here.status !== 'ok') { toast(here.status === 'denied' ? '沒有位置權限，請到瀏覽器設定允許' : '暫時無法定位'); return; }
      p.lat = here.lat; p.lng = here.lng;
      save();
      renderPlaceList();
      renderPlaces();
      updateCount();
      toast(`「${p.name}」已設為目前位置`);
      return;
    }
    if (e.target.closest('[data-pdel]')) {
      const used = S.restaurants.filter((r) => r.place === p.id);
      if (used.length && !confirm(`「${p.name}」底下有 ${used.length} 家餐廳，刪除後會變成「未指定地點」。確定刪除？`)) return;
      const idx = S.places.indexOf(p);
      S.places.splice(idx, 1);
      used.forEach((r) => { r.place = null; });
      if (S.place === p.id) S.place = '__here';
      save();
      renderPlaceList();
      renderPlaces();
      updateCount();
      toast(`已刪除地點「${p.name}」`, '復原', () => {
        S.places.splice(idx, 0, p);
        used.forEach((r) => { r.place = p.id; });
        save();
        renderPlaceList();
        renderPlaces();
        updateCount();
      });
    }
  });

  $('#placeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $('#placeName');
    const name = inp.value.trim();
    if (!name) { reflow(inp, 'shake'); inp.focus(); return; }
    if ($('#placeHere').checked) {
      const p = await saveHereAsPlace(name);
      if (!p) return;
    } else {
      S.places.push({ id: uid('p'), name: name.slice(0, 12) });
      save();
      renderPlaces();
      renderPlaceList();
      toast(`已新增地點「${name}」`);
    }
    inp.value = '';
  });

  // ---------- Google 地圖分享內容解析 ----------
  // 支援：/maps/place/店名/@lat,lng、!3d..!4d..、?q=lat,lng、App 分享的「店名\n地址\n短網址」
  function parseMapsShare(raw) {
    const out = {};
    const text = raw.trim();
    if (!text) return out;
    const urlMatch = text.match(/https?:\/\/\S+/);
    const url = urlMatch ? urlMatch[0] : '';
    if (url) out.url = url;
    const before = (urlMatch ? text.slice(0, urlMatch.index) : text).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (before.length) out.name = before[0];
    if (url) {
      let u = url;
      try { u = decodeURIComponent(url); } catch (e) { /* keep raw */ }
      const place = u.match(/\/maps\/place\/([^/@?]+)/);
      if (place && !out.name) out.name = place[1].replace(/\+/g, ' ').trim();
      const d34 = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      const at = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const q = u.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
      const m = d34 || q || at;
      if (m) { out.lat = +m[1]; out.lng = +m[2]; }
      out.short = /goo\.gl|g\.co\//.test(url);
    }
    return out;
  }

  // ---------- Add / edit sheet ----------
  let form;
  let sheetKind = 'food';
  let editing = null;

  const newForm = (kind) => ({
    e: '🥢', eAuto: true, c: '中式', p: new Set([2]), m: new Set(['L', 'D']), t: new Set(),
    place: kind === 'rest' ? defaultPlaceForNew() : null, lat: null, lng: null, url: '',
  });

  function defaultPlaceForNew() {
    if (S.place !== '__here' && placeById(S.place)) return S.place;
    const near = nearestPlace();
    return near ? near.place.id : (S.places[0] ? S.places[0].id : null);
  }

  function renderForm() {
    const picks = EMOJI_PICKS.includes(form.e) ? EMOJI_PICKS : [form.e, ...EMOJI_PICKS];
    $('#fEmoji').innerHTML = picks.map((em) => `<button type="button" data-em="${em}" aria-pressed="${em === form.e}">${em}</button>`).join('');
    $('#fCat').innerHTML = CATEGORIES.map((c) => chip(c, `data-fc="${c}"`, c === form.c)).join('');
    $('#fMeal').innerHTML = Object.entries(MEALS).map(([k, v]) => chip(v.label, `data-fm="${k}"`, form.m.has(k))).join('');
    $('#fTags').innerHTML = MOODS.map(([k, l]) => chip(l, `data-ft="${k}"`, form.t.has(k))).join('');
    $$('#fPrice button').forEach((b) => b.setAttribute('aria-pressed', String(form.p.has(+b.dataset.p))));
    if (sheetKind === 'rest') {
      $('#fPlace').innerHTML =
        S.places.map((p) => chip(esc(p.name), `data-fpl="${esc(p.id)}"`, form.place === p.id)).join('') +
        chip('不指定', 'data-fpl=""', !form.place);
      const xy = form.lat != null;
      $('#fExtra').innerHTML =
        chip(`${icon('locate')}${xy ? '已記下店家位置' : '我在店裡，記下位置'}`, 'data-fxy', xy);
    }
  }

  let lastFocus = null;
  function openSheet(kind = listKind, item = null) {
    sheetKind = kind;
    editing = item;
    form = newForm(kind);
    if (item) {
      Object.assign(form, {
        e: item.e, eAuto: false, c: item.c, p: new Set(tiers(item)), m: new Set(item.m.split('')), t: new Set(item.t),
        place: item.place || null,
        lat: hasXY(item) ? item.lat : null, lng: hasXY(item) ? item.lng : null, url: item.url || '',
      });
    }
    const rest = kind === 'rest';
    $$('.rest-only', $('#sheet')).forEach((el) => { el.hidden = !rest; });
    $('#sheetTitle').textContent = item ? `編輯${rest ? '餐廳' : '食物'}` : (rest ? '新增口袋餐廳' : '新增食物');
    $('#btnSubmitLabel').textContent = item ? '儲存' : (rest ? '加入口袋名單' : '加入清單');
    $('#btnDelete').hidden = !item;
    $('#fName').placeholder = rest ? '例如：巷口阿忠麵線' : '例如：公司樓下的牛肉麵';
    $('#fName').value = item ? item.n : (listQuery.trim() || '');
    $('#fNote').value = item ? (item.note || '') : '';
    $('#fRaw').value = item ? (item.url || '') : '';
    $('#fRawHint').textContent = '';
    if (!item && form.eAuto) form.e = guessEmoji($('#fName').value, form.c);
    renderForm();
    lastFocus = document.activeElement;
    $('#sheet').classList.add('open');
    $('#sheet').setAttribute('aria-hidden', 'false');
    $('#sheet').scrollTop = 0;
    $('#sheetBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => (rest && !item ? $('#fRaw') : $('#fName')).focus({ preventScroll: true }), 300);
  }
  function closeSheet() {
    $('#sheet').classList.remove('open');
    $('#sheet').setAttribute('aria-hidden', 'true');
    $('#sheetBackdrop').classList.remove('open');
    document.body.style.overflow = '';
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  const sheetOpen = () => $('#sheet').classList.contains('open');

  $('#btnAdd').addEventListener('click', () => openSheet(listKind));
  $('#btnSheetClose').addEventListener('click', closeSheet);
  $('#sheetBackdrop').addEventListener('click', closeSheet);

  function autoEmoji() {
    if (!form.eAuto) return;
    form.e = guessEmoji($('#fName').value, form.c);
  }
  $('#fName').addEventListener('input', () => {
    if (!form.eAuto) return;
    const before = form.e;
    autoEmoji();
    if (form.e !== before) renderForm();
  });

  $('#fRaw').addEventListener('input', (e) => {
    const r = parseMapsShare(e.target.value);
    const hint = $('#fRawHint');
    hint.classList.remove('warn');
    if (!e.target.value.trim()) { hint.textContent = ''; form.url = ''; return; }
    form.url = r.url || '';
    if (r.name) { $('#fName').value = r.name.slice(0, 24); autoEmoji(); }
    if (r.lat != null) { form.lat = r.lat; form.lng = r.lng; }
    const got = [r.name && '店名', r.lat != null && '位置', r.url && '地圖連結'].filter(Boolean);
    if (got.length) hint.textContent = `已帶入：${got.join('、')}`;
    else { hint.textContent = '看不出店名，請手動填寫'; hint.classList.add('warn'); }
    if (r.short && !r.name) { hint.textContent = '短網址無法讀出店名，請手動填寫（連結會保留給導航用）'; hint.classList.add('warn'); }
    renderForm();
  });

  $('#sheet').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b || b.type === 'submit') return;
    const d = b.dataset;
    if (d.em) { form.e = d.em; form.eAuto = false; }
    else if (d.fc) { form.c = d.fc; autoEmoji(); }
    else if (d.p) {
      // 價位可複選，但至少留一個
      const v = +d.p;
      if (form.p.has(v)) { if (form.p.size > 1) form.p.delete(v); } else form.p.add(v);
    }
    else if (d.fm) form.m.has(d.fm) ? form.m.delete(d.fm) : form.m.add(d.fm);
    else if (d.ft) form.t.has(d.ft) ? form.t.delete(d.ft) : form.t.add(d.ft);
    else if ('fpl' in d) form.place = d.fpl || null;
    else if ('fxy' in d) {
      if (form.lat != null) { form.lat = null; form.lng = null; }
      else {
        await locate(true);
        if (here.status !== 'ok') { toast(here.status === 'denied' ? '沒有位置權限' : '暫時無法定位'); return; }
        form.lat = here.lat; form.lng = here.lng;
      }
    }
    else return;
    buzz(5);
    renderForm();
  });

  $('#btnDelete').addEventListener('click', () => {
    if (!editing) return;
    const arr = sheetKind === 'rest' ? S.restaurants : S.custom;
    const idx = arr.indexOf(editing);
    if (idx < 0) return;
    const [removed] = arr.splice(idx, 1);
    save();
    closeSheet();
    renderList();
    updateCount();
    toast(`已刪除「${removed.n}」`, '復原', () => { arr.splice(idx, 0, removed); save(); renderList(); updateCount(); });
  });

  // Swipe-down to close (mobile bottom sheet)
  (() => {
    let y0 = null;
    const sh = $('#sheet');
    sh.addEventListener('touchstart', (e) => { y0 = sh.scrollTop <= 0 && innerWidth < 700 ? e.touches[0].clientY : null; }, { passive: true });
    sh.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      const dy = e.touches[0].clientY - y0;
      if (dy > 0) sh.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sh.addEventListener('touchend', (e) => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0;
      sh.style.transform = '';
      y0 = null;
      if (dy > 110) closeSheet();
    });
  })();

  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameEl = $('#fName');
    const n = nameEl.value.trim();
    if (!n) {
      reflow(nameEl, 'shake');
      nameEl.focus();
      buzz([10, 40, 10]);
      return;
    }
    const base = {
      n, e: form.e, c: form.c, p: form.p.size > 1 ? [...form.p].sort() : [...form.p][0],
      t: [...form.t],
      m: form.m.size ? ['L', 'D', 'N'].filter((k) => form.m.has(k)).join('') : 'LDN',
    };
    let item;
    if (sheetKind === 'rest') {
      item = { ...base, kind: 'rest', place: form.place, note: $('#fNote').value.trim() };
      if (form.lat != null) { item.lat = form.lat; item.lng = form.lng; }
      if (form.url) item.url = form.url;
    } else {
      item = { ...base, custom: true };
    }
    const arr = sheetKind === 'rest' ? S.restaurants : S.custom;
    const wasEditing = !!editing;
    if (editing) {
      Object.keys(editing).forEach((k) => { if (k !== 'id') delete editing[k]; });
      Object.assign(editing, item);
    } else {
      arr.unshift({ id: uid(sheetKind === 'rest' ? 'r' : 'c'), ...item });
    }
    save();
    closeSheet();
    listQuery = '';
    $('#listSearch').value = '';
    listCat = '';
    listKind = sheetKind;
    if (view === 'list') renderList();
    updateCount();
    buzz(16);
    toast(wasEditing ? `已更新「${n}」` : `已加入「${n}」`);
  });

  // ---------- History view ----------
  function dayLabel(ts) {
    const d = new Date(ts);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((today - that) / DAY);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${WEEK[d.getDay()]}`;
  }
  const hhmm = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  function renderHistory() {
    const h = S.history;
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
    $('#statWeek').textContent = h.filter((x) => x.ts >= monday).length;

    const since = Date.now() - 30 * DAY;
    const cnt = {};
    h.filter((x) => x.ts >= since).forEach((x) => { cnt[x.n] = (cnt[x.n] || 0) + 1; });
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    $('#statTop').textContent = top ? top[0] : '—';
    $('#statTopSub').textContent = top ? `近 30 天最常吃 · ${top[1]} 次` : '近 30 天最常吃';

    $('#historyEmpty').hidden = h.length > 0;
    $('#btnClearHistory').hidden = !h.length;
    let html = '';
    let lastDay = null;
    h.slice(0, 100).forEach((x) => {
      const lbl = dayLabel(x.ts);
      if (lbl !== lastDay) {
        if (lastDay !== null) html += '</ul>';
        html += `<div class="day-label">${lbl}</div><ul class="list history-list">`;
        lastDay = lbl;
      }
      const sub = [MEALS[x.m]?.label, x.r ? (x.pl ? `口袋餐廳 · ${x.pl}` : '口袋餐廳') : '', hhmm(x.ts)].filter(Boolean).join(' · ');
      html += `<li class="row" data-ts="${x.ts}">
        <span class="row-emoji">${esc(x.e)}</span>
        <div class="row-main"><div class="row-name">${esc(x.n)}</div><div class="row-sub">${esc(sub)}</div></div>
        <button class="icon-btn" type="button" data-hdel aria-label="刪除紀錄">${icon('x')}</button>
      </li>`;
    });
    if (lastDay !== null) html += '</ul>';
    $('#historyList').innerHTML = html;
  }

  $('#historyList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hdel]');
    if (!b) return;
    const ts = +b.closest('.row').dataset.ts;
    const idx = S.history.findIndex((x) => x.ts === ts);
    if (idx < 0) return;
    const [removed] = S.history.splice(idx, 1);
    save();
    renderHistory();
    toast(`已刪除「${removed.n}」`, '復原', () => { S.history.splice(idx, 0, removed); save(); renderHistory(); });
  });

  $('#btnClearHistory').addEventListener('click', () => {
    const backup = S.history;
    S.history = [];
    save();
    renderHistory();
    toast('已清除所有紀錄', '復原', () => { S.history = backup; save(); renderHistory(); });
  });

  // ---------- Backup ----------
  $('#btnExport').addEventListener('click', () => {
    const data = { app: 'what-to-eat', version: 1, exported: new Date().toISOString(), ...S };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `今天吃什麼-備份-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('已匯出備份檔');
  });
  $('#btnImport').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'what-to-eat') throw new Error('not a backup');
      const r = (data.restaurants || []).length, h = (data.history || []).length;
      if (!confirm(`要用這份備份取代目前的資料嗎？\n口袋餐廳 ${r} 家、紀錄 ${h} 筆`)) return;
      delete data.app; delete data.version; delete data.exported;
      localStorage.setItem(KEY, JSON.stringify(data));
      S = load();
      refreshAll();
      toast('已匯入備份');
    } catch (err) {
      toast('這不是有效的備份檔');
    }
  });

  $('#btnResetAll').addEventListener('click', () => {
    if (!confirm('確定要清除所有資料嗎？\n（口袋餐廳、地點、自訂清單、紀錄與設定都會被刪除）')) return;
    localStorage.removeItem(KEY);
    S = load();
    refreshAll();
    toast('已重設所有資料');
  });

  function refreshAll() {
    skipped.clear();
    current = null;
    applyTheme();
    renderFilters();
    renderMode();
    if (view === 'settings') renderSettings();
  }

  // ---------- Install (PWA) ----------
  const INSTALL_KEY = 'wte:installDismissed';
  let deferredPrompt = null;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function showInstall(kind) {
    if (isStandalone() || localStorage.getItem(INSTALL_KEY)) return;
    $('#install').hidden = false;
    $('#installText').textContent = kind === 'ios' ? '點 Safari 的「分享」→「加入主畫面」' : '一鍵安裝，像 App 一樣秒開';
    $('#btnInstall').hidden = kind === 'ios';
  }
  const hideInstall = () => { $('#install').hidden = true; };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstall('prompt');
  });
  window.addEventListener('appinstalled', () => { hideInstall(); toast('安裝完成，之後從主畫面開啟'); });
  $('#btnInstall').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (e) { /* noop */ }
    deferredPrompt = null;
    hideInstall();
  });
  $('#btnInstallClose').addEventListener('click', () => { localStorage.setItem(INSTALL_KEY, '1'); hideInstall(); });

  // ---------- Global ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen()) { closeSheet(); return; }
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (sheetOpen() || /INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.key === 'Escape' && view === 'result') { switchView('decide'); return; }
    if (view !== 'decide' && view !== 'result') return;
    if (e.code === 'Space') { e.preventDefault(); if (!$('#btnSpin').disabled) spin(); }
    if (e.key === 'Enter' && view === 'result' && current && !confirmed && tag !== 'BUTTON' && tag !== 'A') confirmPick();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden || mealManual) return;
    const m = autoMeal();
    if (m !== meal) { meal = m; renderMeal(); updateCount(); }
  });

  // ---------- 電腦版版面 ----------
  // 電腦版：分頁列放在各頁標題下方，安裝提示改浮在畫面底部；手機版維持底部分頁列、安裝提示在頂部
  const desktopMQ = matchMedia('(min-width: 900px)');
  function placeChrome() {
    const nav = $('.tabbar');
    const inst = $('#install');
    const desktop = desktopMQ.matches;
    document.body.classList.toggle('is-desktop', desktop);
    if (desktop) {
      const head = $('.view.active .page-top, .view.active .bar');
      if (head && head.nextElementSibling !== nav) head.after(nav);
      if (inst.parentElement !== document.body) $('#sheetBackdrop').before(inst);
    } else {
      if (nav.parentElement !== document.body) $('#sheetBackdrop').before(nav);
      const top = $('#view-decide .page-top');
      if (top.nextElementSibling !== inst) top.after(inst);
    }
  }
  desktopMQ.addEventListener?.('change', placeChrome);

  // ---------- Init ----------
  placeChrome();
  applyTheme();
  renderMeal();
  renderFilters();
  renderMode();
  if (isPocket() && S.place === '__here') locate();
  if (isIOS && !isStandalone()) setTimeout(() => showInstall('ios'), 1500);

  const params = new URLSearchParams(location.search);
  const v = params.get('view');
  if (v === 'list') listKind = isPocket() ? 'rest' : 'food';
  if (['list', 'history', 'settings'].includes(v)) switchView(v);
  if (params.get('spin') === '1') setTimeout(spin, 450);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support unavailable */ });
    });
  }
})();
