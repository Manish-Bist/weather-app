// Skyline Weather — uses free, keyless APIs: Open-Meteo (forecast) + Open-Meteo Geocoding (search)

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const state = {
  unit: localStorage.getItem('skyline_unit') || 'c',
  saved: JSON.parse(localStorage.getItem('skyline_saved') || '[]'),
  current: null,      // last fetched weather payload
  place: null,         // { name, admin1, country, lat, lon }
  suggestions: [],
  activeSuggestion: -1,
};

const $ = (sel) => document.querySelector(sel);
const els = {
  search: $('#searchInput'),
  suggestions: $('#suggestions'),
  locBtn: $('#locBtn'),
  unitToggle: $('#unitToggle'),
  chips: $('#savedChips'),
  loading: $('#loadingState'),
  error: $('#errorState'),
  errorMsg: $('#errorMsg'),
  retryBtn: $('#retryBtn'),
  content: $('#content'),
  cityName: $('#cityName'),
  saveBtn: $('#saveBtn'),
  dateLine: $('#dateLine'),
  condIcon: $('#condIcon'),
  condText: $('#condText'),
  tempMain: $('#tempMain'),
  feelsLike: $('#feelsLike'),
  hiLow: $('#hiLow'),
  hourlyStrip: $('#hourlyStrip'),
  detailsGrid: $('#detailsGrid'),
  dailyList: $('#dailyList'),
  updatedAt: $('#updatedAt'),
};

// Weather code → category / icon / label
const WMO = {
  0: { label: 'Clear sky', cat: 'clear' },
  1: { label: 'Mostly clear', cat: 'clear' },
  2: { label: 'Partly cloudy', cat: 'cloudy' },
  3: { label: 'Overcast', cat: 'overcast' },
  45: { label: 'Fog', cat: 'fog' },
  48: { label: 'Rime fog', cat: 'fog' },
  51: { label: 'Light drizzle', cat: 'rain' },
  53: { label: 'Drizzle', cat: 'rain' },
  55: { label: 'Dense drizzle', cat: 'rain' },
  56: { label: 'Freezing drizzle', cat: 'rain' },
  57: { label: 'Freezing drizzle', cat: 'rain' },
  61: { label: 'Light rain', cat: 'rain' },
  63: { label: 'Rain', cat: 'rain' },
  65: { label: 'Heavy rain', cat: 'rain' },
  66: { label: 'Freezing rain', cat: 'rain' },
  67: { label: 'Freezing rain', cat: 'rain' },
  71: { label: 'Light snow', cat: 'snow' },
  73: { label: 'Snow', cat: 'snow' },
  75: { label: 'Heavy snow', cat: 'snow' },
  77: { label: 'Snow grains', cat: 'snow' },
  80: { label: 'Rain showers', cat: 'rain' },
  81: { label: 'Rain showers', cat: 'rain' },
  82: { label: 'Violent showers', cat: 'rain' },
  85: { label: 'Snow showers', cat: 'snow' },
  86: { label: 'Snow showers', cat: 'snow' },
  95: { label: 'Thunderstorm', cat: 'thunder' },
  96: { label: 'Thunderstorm + hail', cat: 'thunder' },
  99: { label: 'Thunderstorm + hail', cat: 'thunder' },
};
const wmoInfo = (code) => WMO[code] || { label: 'Unsettled', cat: 'cloudy' };

/* Sky gradients per category, day / night */
const SKY = {
  clear:    { day: ['#3E8FE0', '#7FC2F2', '#FFE9BE'], night: ['#050814', '#0B1026', '#1a1a3d'] },
  cloudy:   { day: ['#6C90B0', '#9FB6C9', '#D8E2E8'], night: ['#0d1220', '#1c2536', '#2a3345'] },
  overcast: { day: ['#5C6E7E', '#7C8A96', '#A9B4BC'], night: ['#0b0f16', '#191f28', '#262c34'] },
  fog:      { day: ['#8B96A0', '#B7BFC6', '#D9DEE1'], night: ['#14171c', '#22262c', '#31353b'] },
  rain:     { day: ['#39485C', '#526075', '#7A8A9C'], night: ['#080b13', '#131a26', '#1d2634'] },
  snow:     { day: ['#7C8CA3', '#B9C6D6', '#EAF1F8'], night: ['#0e1220', '#1a2033', '#2a3348'] },
  thunder:  { day: ['#232A38', '#3C4356', '#5A6070'], night: ['#05060a', '#0d0f16', '#181a22'] },
};

// SVG icon factory
function iconSVG(code, isDay, animated = true) {
  const cat = wmoInfo(code).cat;
  const a = animated;
  const sun = `<svg viewBox="0 0 48 48" fill="none"><circle class="${a?'sun-core':''}" cx="24" cy="24" r="10" fill="url(#sg)"/><g stroke="#FFC46B" stroke-width="2.4" stroke-linecap="round">
    <path d="M24 4v5M24 39v5M4 24h5M39 24h5M9.9 9.9l3.5 3.5M34.6 34.6l3.5 3.5M9.9 38.1l3.5-3.5M34.6 13.4l3.5-3.5"/></g>
    <defs><radialGradient id="sg" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFE9BE"/><stop offset="1" stop-color="#FFB84D"/></radialGradient></defs></svg>`;
  const moon = `<svg viewBox="0 0 48 48" fill="none"><path class="${a?'sun-core':''}" d="M31 6a18 18 0 1 0 11 24 14 14 0 0 1-11-24Z" fill="#DCE3F0"/></svg>`;
  const cloud = (fill='#E7ECF2') => `<g class="${a?'cloud-drift':''}"><path d="M14 34a8 8 0 0 1-1-15.9A10 10 0 0 1 32 14.5 8.5 8.5 0 0 1 34 34H14Z" fill="${fill}"/></g>`;
  const cloudSun = `<svg viewBox="0 0 48 48" fill="none"><g class="${a?'sun-core':''}"><circle cx="18" cy="16" r="8" fill="url(#sg2)"/></g>${cloud()}<defs><radialGradient id="sg2" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFE9BE"/><stop offset="1" stop-color="#FFB84D"/></radialGradient></defs></svg>`;
  const cloudMoon = `<svg viewBox="0 0 48 48" fill="none"><path class="${a?'sun-core':''}" d="M23 8a10 10 0 1 0 6 14 8 8 0 0 1-6-14Z" fill="#DCE3F0"/>${cloud()}</svg>`;
  const overcastIcon = `<svg viewBox="0 0 48 48" fill="none">${cloud('#CBD3DB')}<g class="${a?'cloud-drift':''}" style="animation-delay:.4s"><path d="M8 24a6 6 0 0 1 0-12 8 8 0 0 1 15.4-2.4A6.5 6.5 0 0 1 24 22H8Z" fill="#AEB8C2" opacity="0.8"/></g></svg>`;
  const rain = `<svg viewBox="0 0 48 48" fill="none">${cloud('#B9C3CC')}<g stroke="#7FCBFF" stroke-width="2.2" stroke-linecap="round">
    <path class="${a?'rain-drop':''}" d="M16 36v4"/><path class="${a?'rain-drop':''}" d="M24 36v4"/><path class="${a?'rain-drop':''}" d="M32 36v4"/></g></svg>`;
  const snow = `<svg viewBox="0 0 48 48" fill="none">${cloud('#C7D0DA')}<g stroke="#EAF3FF" stroke-width="2" stroke-linecap="round">
    <path class="${a?'snow-flake':''}" d="M16 36v5M13.5 38.5h5"/><path class="${a?'snow-flake':''}" d="M24 36v5M21.5 38.5h5"/><path class="${a?'snow-flake':''}" d="M32 36v5M29.5 38.5h5"/></g></svg>`;
  const fog = `<svg viewBox="0 0 48 48" fill="none"><g stroke="#D4DAE0" stroke-width="2.6" stroke-linecap="round">
    <path d="M8 18h32"/><path d="M6 25h36"/><path d="M8 32h28"/></g></svg>`;
  const thunder = `<svg viewBox="0 0 48 48" fill="none">${cloud('#9AA6B2')}<path class="${a?'bolt-flash':''}" d="M25 22l-7 12h6l-2 10 9-14h-6l3-8h-3Z" fill="#FFD166"/></svg>`;

  if (cat === 'clear') return isDay ? sun : moon;
  if (cat === 'cloudy') return isDay ? cloudSun : cloudMoon;
  if (cat === 'overcast') return overcastIcon;
  if (cat === 'fog') return fog;
  if (cat === 'rain') return rain;
  if (cat === 'snow') return snow;
  if (cat === 'thunder') return thunder;
  return isDay ? sun : moon;
}

// Animated sky canvas
const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');
let dpr = Math.min(window.devicePixelRatio || 1, 2);
let W, H;
let particles = [];
let skyCat = 'clear';
let skyIsDay = true;
let rafId = null;

function resizeCanvas() {
  W = canvas.width = window.innerWidth * dpr;
  H = canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function lerpColor(a, b, t) {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0]-pa[0])*t);
  const g = Math.round(pa[1] + (pb[1]-pa[1])*t);
  const bl = Math.round(pa[2] + (pb[2]-pa[2])*t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex) {
  const h = hex.replace('#','');
  return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
}

function setSky(cat, isDay) {
  skyCat = cat; skyIsDay = isDay;
  const stops = (SKY[cat] || SKY.clear)[isDay ? 'day' : 'night'];
  document.body.style.background = `linear-gradient(180deg, ${stops[0]}, ${stops[1]} 55%, ${stops[2]})`;
  buildParticles();
}

function buildParticles() {
  particles = [];
  const count = { rain: 140, snow: 90, thunder: 90, fog: 0, clear: skyIsDay ? 0 : 70, cloudy: 0, overcast: 0 }[skyCat] ?? 0;
  for (let i = 0; i < count; i++) {
    if (skyCat === 'rain' || skyCat === 'thunder') {
      particles.push({ x: Math.random()*W, y: Math.random()*H, len: (10+Math.random()*16)*dpr, speed: (9+Math.random()*7)*dpr, drift: 2*dpr, type: 'rain' });
    } else if (skyCat === 'snow') {
      particles.push({ x: Math.random()*W, y: Math.random()*H, r: (1.4+Math.random()*2.4)*dpr, speed: (0.7+Math.random()*1.3)*dpr, drift: Math.random()*2-1, phase: Math.random()*Math.PI*2, type: 'snow' });
    } else if (skyCat === 'clear' && !skyIsDay) {
      particles.push({ x: Math.random()*W, y: Math.random()*H*0.7, r: Math.random()*1.4*dpr+0.3, tw: Math.random()*Math.PI*2, type: 'star' });
    }
  }
  // ambient clouds for cloudy/overcast/fog
  if (['cloudy','overcast','fog','rain','snow','thunder'].includes(skyCat)) {
    const n = skyCat === 'overcast' ? 6 : 4;
    for (let i = 0; i < n; i++) {
      particles.push({
        x: Math.random()*W, y: (0.08+Math.random()*0.32)*H,
        w: (140+Math.random()*180)*dpr, speed: (0.12+Math.random()*0.18)*dpr,
        opacity: 0.10+Math.random()*0.14, type: 'cloud'
      });
    }
  }
}

function drawCloud(p) {
  ctx.save();
  ctx.globalAlpha = p.opacity;
  ctx.fillStyle = '#ffffff';
  const w = p.w, h = w*0.42;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, w*0.3, h*0.5, 0, 0, Math.PI*2);
  ctx.ellipse(p.x+w*0.25, p.y-h*0.15, w*0.24, h*0.42, 0, 0, Math.PI*2);
  ctx.ellipse(p.x-w*0.25, p.y-h*0.1, w*0.22, h*0.4, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function tick() {
  ctx.clearRect(0, 0, W, H);
  for (const p of particles) {
    if (p.type === 'rain') {
      ctx.strokeStyle = 'rgba(190,220,255,0.5)';
      ctx.lineWidth = 1.4*dpr;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.drift, p.y + p.len);
      ctx.stroke();
      p.y += p.speed; p.x -= p.drift*0.3;
      if (p.y > H) { p.y = -p.len; p.x = Math.random()*W; }
    } else if (p.type === 'snow') {
      p.phase += 0.02;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(p.phase)*8*dpr, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
      p.y += p.speed;
      if (p.y > H) { p.y = -4; p.x = Math.random()*W; }
    } else if (p.type === 'star') {
      p.tw += 0.03;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + Math.sin(p.tw)*0.35})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    } else if (p.type === 'cloud') {
      drawCloud(p);
      p.x += p.speed;
      if (p.x - p.w > W) p.x = -p.w;
    }
  }
  rafId = requestAnimationFrame(tick);
}
tick();

// Utility formatting
const toDisplayTemp = (celsius) => state.unit === 'c' ? Math.round(celsius) : Math.round(celsius * 9/5 + 32);
const unitSuffix = () => state.unit === 'c' ? '°C' : '°F';

function fmtDate(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtHour(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, { hour: 'numeric' });
}
function fmtDay(dateStr, idx) {
  if (idx === 0) return 'Today';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}
function compassLabel(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Fetching
async function geocode(query) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('geocode failed');
  const data = await res.json();
  return data.results || [];
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `${REVERSE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const name = data.city || data.locality || data.principalSubdivision;
    if (!name) return null;
    return { name, admin1: data.principalSubdivision, country: data.countryName };
  } catch { return null; }
}

async function fetchForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day,surface_pressure,uv_index,visibility',
    hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max',
    timezone: 'auto',
    wind_speed_unit: 'kmh',
    forecast_days: '7',
  });
  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) throw new Error('forecast failed');
  return res.json();
}

// Rendering
function showState(name) {
  els.loading.hidden = name !== 'loading';
  els.error.hidden = name !== 'error';
  els.content.hidden = name !== 'content';
}

function render(weather, place) {
  state.current = weather;
  state.place = place;

  const cur = weather.current;
  const info = wmoInfo(cur.weather_code);
  const isDay = !!cur.is_day;

  setSky(info.cat, isDay);

  els.cityName.textContent = place.name;
  els.dateLine.textContent = fmtDate(new Date());
  els.condIcon.innerHTML = iconSVG(cur.weather_code, isDay);
  els.condText.textContent = info.label;
  els.tempMain.textContent = toDisplayTemp(cur.temperature_2m);
  els.feelsLike.textContent = `Feels like ${toDisplayTemp(cur.apparent_temperature)}°`;

  const todayMax = weather.daily.temperature_2m_max[0];
  const todayMin = weather.daily.temperature_2m_min[0];
  els.hiLow.textContent = `H: ${toDisplayTemp(todayMax)}°  L: ${toDisplayTemp(todayMin)}°`;

  animateSwap(els.tempMain);
  updateSaveBtn();
  renderHourly(weather);
  renderDetails(weather);
  renderDaily(weather);

  els.updatedAt.textContent = `Updated ${new Date().toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}`;
  showState('content');
}

function animateSwap(el) {
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

function renderHourly(weather) {
  const now = new Date();
  const hourly = weather.hourly;
  let startIdx = hourly.time.findIndex(t => new Date(t) >= now);
  if (startIdx < 0) startIdx = 0;
  const slice = [];
  for (let i = startIdx; i < startIdx + 24 && i < hourly.time.length; i++) slice.push(i);

  els.hourlyStrip.innerHTML = slice.map((idx, pos) => {
    const t = hourly.time[idx];
    const temp = toDisplayTemp(hourly.temperature_2m[idx]);
    const pop = hourly.precipitation_probability[idx];
    const icon = iconSVG(hourly.weather_code[idx], hourly.is_day[idx], false);
    return `<div class="hour-card ${pos===0?'now':''}">
      <div class="h-time">${pos===0 ? 'Now' : fmtHour(t)}</div>
      <div class="h-icon">${icon}</div>
      <div class="h-temp">${temp}°</div>
      <div class="h-precip">${pop > 10 ? pop + '%' : ''}</div>
    </div>`;
  }).join('');
}

function detailCard(label, iconSvg, value, sub = '') {
  return `<div class="detail-card">
    <div class="detail-label">${iconSvg}<span>${label}</span></div>
    <div class="detail-value">${value}</div>
    ${sub ? `<div class="detail-sub">${sub}</div>` : ''}
  </div>`;
}

const ICONS = {
  humidity: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3s7 7.5 7 12a7 7 0 1 1-14 0c0-4.5 7-12 7-12Z" stroke="currentColor" stroke-width="1.8"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 8h11a3 3 0 1 0-3-3M3 16h14a3 3 0 1 1-3 3M3 12h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  uv: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2 2M17 17l2 2M4.9 19.1l2-2M17 7l2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  sunrise: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v6M5 13a7 7 0 0 1 14 0M2 13h20M4 18h16M7 21h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  sunset: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 9V3M5 13a7 7 0 0 1 14 0M2 13h20M4 18h16M7 21h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  pressure: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  visibility: `<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`,
};

function uvLabel(v) {
  if (v < 3) return 'Low';
  if (v < 6) return 'Moderate';
  if (v < 8) return 'High';
  if (v < 11) return 'Very high';
  return 'Extreme';
}

function renderDetails(weather) {
  const cur = weather.current;
  const daily = weather.daily;
  const sunrise = new Date(daily.sunrise[0]);
  const sunset = new Date(daily.sunset[0]);
  const timeFmt = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const visKm = (cur.visibility / 1000).toFixed(1);

  els.detailsGrid.innerHTML = [
    detailCard('Humidity', ICONS.humidity, `${cur.relative_humidity_2m}%`),
    detailCard('Wind', ICONS.wind, `${Math.round(cur.wind_speed_10m)} km/h`,
      `<span class="compass" style="transform:rotate(${cur.wind_direction_10m}deg)">↑</span> ${compassLabel(cur.wind_direction_10m)}`),
    detailCard('UV index', ICONS.uv, Math.round(cur.uv_index ?? daily.uv_index_max[0]), uvLabel(cur.uv_index ?? daily.uv_index_max[0])),
    detailCard('Sunrise', ICONS.sunrise, timeFmt(sunrise)),
    detailCard('Sunset', ICONS.sunset, timeFmt(sunset)),
    detailCard('Pressure', ICONS.pressure, `${Math.round(cur.surface_pressure)}`, 'hPa'),
    detailCard('Visibility', ICONS.visibility, `${visKm} km`),
  ].join('');
}

function renderDaily(weather) {
  const daily = weather.daily;
  const globalMax = Math.max(...daily.temperature_2m_max);
  const globalMin = Math.min(...daily.temperature_2m_min);
  const span = Math.max(globalMax - globalMin, 1);

  els.dailyList.innerHTML = daily.time.map((t, i) => {
    const info = wmoInfo(daily.weather_code[i]);
    const icon = iconSVG(daily.weather_code[i], true, false);
    const max = daily.temperature_2m_max[i], min = daily.temperature_2m_min[i];
    const left = ((min - globalMin) / span) * 100;
    const width = ((max - min) / span) * 100;
    const pop = daily.precipitation_probability_max[i];
    return `<div class="day-row">
      <div class="d-name">${fmtDay(t, i)}<small>${info.label}</small></div>
      <div class="d-icon">${icon}</div>
      <div class="range-bar"><div class="range-fill" style="left:${left}%;width:${width}%"></div></div>
      <div class="d-temps"><span class="hi">${toDisplayTemp(max)}°</span><span class="lo">${toDisplayTemp(min)}°</span></div>
      <div class="d-precip">${pop > 10 ? '☔ ' + pop + '%' : ''}</div>
    </div>`;
  }).join('');
}

// Save / load location flow
async function loadPlace(place) {
  showState('loading');
  try {
    const weather = await fetchForecast(place.latitude, place.longitude);
    render(weather, place);
    renderChips();
  } catch (e) {
    els.errorMsg.textContent = "Couldn't load weather for that place. Check your connection and try again.";
    showState('error');
  }
}

function placeKey(p) { return `${p.latitude.toFixed(2)},${p.longitude.toFixed(2)}`; }

function updateSaveBtn() {
  if (!state.place) return;
  const saved = state.saved.some(p => placeKey(p) === placeKey(state.place));
  els.saveBtn.classList.toggle('saved', saved);
}

function toggleSave() {
  if (!state.place) return;
  const key = placeKey(state.place);
  const idx = state.saved.findIndex(p => placeKey(p) === key);
  if (idx >= 0) state.saved.splice(idx, 1);
  else state.saved.unshift(state.place);
  state.saved = state.saved.slice(0, 8);
  localStorage.setItem('skyline_saved', JSON.stringify(state.saved));
  updateSaveBtn();
  renderChips();
}

function renderChips() {
  els.chips.innerHTML = state.saved.map(p => {
    const active = state.place && placeKey(p) === placeKey(state.place);
    return `<button class="chip ${active?'active':''}" data-key="${placeKey(p)}">
      <span>${p.name}</span><span class="chip-remove" data-remove="${placeKey(p)}">×</span>
    </button>`;
  }).join('');
}

els.chips.addEventListener('click', (e) => {
  const removeKey = e.target.getAttribute('data-remove');
  if (removeKey) {
    e.stopPropagation();
    state.saved = state.saved.filter(p => placeKey(p) !== removeKey);
    localStorage.setItem('skyline_saved', JSON.stringify(state.saved));
    renderChips();
    return;
  }
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const key = chip.getAttribute('data-key');
  const place = state.saved.find(p => placeKey(p) === key);
  if (place) loadPlace(place);
});

els.saveBtn.addEventListener('click', toggleSave);
els.retryBtn.addEventListener('click', () => state.place && loadPlace(state.place));

// Search + autocomplete
let debounceTimer = null;

els.search.addEventListener('input', () => {
  const q = els.search.value.trim();
  clearTimeout(debounceTimer);
  if (q.length < 2) { closeSuggestions(); return; }
  debounceTimer = setTimeout(async () => {
    try {
      const results = await geocode(q);
      state.suggestions = results;
      state.activeSuggestion = -1;
      renderSuggestions();
    } catch { closeSuggestions(); }
  }, 280);
});

function renderSuggestions() {
  if (!state.suggestions.length) { closeSuggestions(); return; }
  els.suggestions.innerHTML = state.suggestions.map((r, i) => {
    const region = [r.admin1, r.country].filter(Boolean).join(', ');
    return `<li data-idx="${i}" class="${i===state.activeSuggestion?'active':''}"><strong>${r.name}</strong><span>${region}</span></li>`;
  }).join('');
  els.suggestions.hidden = false;
}

function closeSuggestions() {
  els.suggestions.hidden = true;
  els.suggestions.innerHTML = '';
  state.suggestions = [];
}

els.suggestions.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  selectSuggestion(Number(li.dataset.idx));
});

function selectSuggestion(idx) {
  const r = state.suggestions[idx];
  if (!r) return;
  els.search.value = '';
  closeSuggestions();
  loadPlace(r);
}

els.search.addEventListener('keydown', (e) => {
  if (els.suggestions.hidden) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.activeSuggestion = Math.min(state.activeSuggestion + 1, state.suggestions.length - 1);
    renderSuggestions();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.activeSuggestion = Math.max(state.activeSuggestion - 1, 0);
    renderSuggestions();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (state.activeSuggestion >= 0) selectSuggestion(state.activeSuggestion);
    else if (state.suggestions.length) selectSuggestion(0);
  } else if (e.key === 'Escape') {
    closeSuggestions();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) closeSuggestions();
});

// Geolocation
els.locBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    els.errorMsg.textContent = 'Geolocation is not supported in this browser.';
    showState('error');
    return;
  }
  els.locBtn.classList.add('loading');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    els.locBtn.classList.remove('loading');
    const { latitude, longitude } = pos.coords;
    const rev = await reverseGeocode(latitude, longitude);
    const place = rev
      ? { name: rev.name, admin1: rev.admin1, country: rev.country, latitude, longitude }
      : { name: 'My location', latitude, longitude };
    loadPlace(place);
  }, () => {
    els.locBtn.classList.remove('loading');
    els.errorMsg.textContent = 'Location access was denied. Search for a city instead.';
    showState('error');
  }, { timeout: 10000 });
});

// Unit toggle
function applyUnitUI() {
  els.unitToggle.querySelectorAll('.unit').forEach(u => {
    u.classList.toggle('active', u.dataset.unit === state.unit);
  });
}
els.unitToggle.addEventListener('click', () => {
  state.unit = state.unit === 'c' ? 'f' : 'c';
  localStorage.setItem('skyline_unit', state.unit);
  applyUnitUI();
  if (state.current && state.place) render(state.current, state.place);
});
applyUnitUI();

// Boot
async function boot() {
  setSky('clear', true); // ambient sky while we figure out a location
  showState('loading');

  if (state.saved.length) {
    renderChips();
    return loadPlace(state.saved[0]);
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const rev = await reverseGeocode(latitude, longitude);
      const place = rev
        ? { name: rev.name, admin1: rev.admin1, country: rev.country, latitude, longitude }
        : { name: 'My location', latitude, longitude };
      loadPlace(place);
    }, () => {
      loadPlace({ name: 'Kathmandu', country: 'Nepal', latitude: 27.7172, longitude: 85.324 });
    }, { timeout: 8000 });
  } else {
    loadPlace({ name: 'Kathmandu', country: 'Nepal', latitude: 27.7172, longitude: 85.324 });
  }
}

boot();
