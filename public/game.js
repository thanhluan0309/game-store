import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ======================= helpers ======================= */
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const vibrate = ms => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };
const pickOf = (arr, i) => arr[Math.abs(i | 0) % arr.length];

const EMO = { tomato: '🍅', lettuce: '🥬', onion: '🧅', meat: '🥩', bread: '🍞', soupT: '🍲', soupO: '🥣', ext: '🧯', mop: '🧹' };
const PART_HTML = { tomato: '🍅', lettuce: '🥬', bread: '🍞', meat: '🥩', soupT: '🍅<small>×3</small>', soupO: '🧅<small>×3</small>' };
const SHOUTS = ['Cần cà chua! 🍅', 'Đĩa đâu?! 🍽️', 'Nhanh lênnn!! 🔥', 'Để tao làm!', 'Cháy rồi!!! 😱', 'Chuột kìa!! 🐀', 'Ra ghi món đi! 🙋', 'Ngon! 👍'];
const NPC_SPOTS = { wash: { x: 8, y: 7.45, a: 0, name: 'NV rửa bát' }, chop: { x: 1.38, y: 3.0, a: -Math.PI / 2, name: 'Phụ bếp' }, prep: { x: 8, y: 1.4, a: Math.PI, name: 'NV sơ chế' } };
const TYPE = {
  '#': 'counter', p: 'counter', T: 'crate', L: 'crate', O: 'crate', M: 'crate', B: 'crate', C: 'board', S: 'stove', F: 'stove',
  W: 'sink', R: 'rack', G: 'trash', P: 'pass', w: 'wall', t: 'table', h: 'chair', E: 'door',
};
const CRATE = { T: 'tomato', L: 'lettuce', O: 'onion', M: 'meat', B: 'bread' };
const SHIRTS = ['#e76f51', '#2a9d8f', '#e9c46a', '#8e7dbe', '#f4a261', '#4d908e', '#d1495b', '#577590'];
const HAIRS = ['#2b1d14', '#5a3a1e', '#1d1d1d', '#8b5a2b', '#c49a6c', '#3d2b1f', '#111111', '#7a4a2a'];
const PHRASES = {
  order: ['Cho tui {d} nha!', 'Một {d}, làm nhanh giùm!', 'Tui muốn ăn {d}!', 'Lấy {d} đi em ơi!'],
  grumble: ['Lâu quá vậy trời!', 'Có ai phục vụ không vậy?', 'Đói quá đi mất!', 'Ủa alo, quán còn mở không?', 'Chờ mỏi cổ luôn rồi nè!', 'Em ơi, bàn này nè!'],
  angry: ['Quán gì mà chậm như rùa!', 'Bực mình ghê á!', 'Đồ ăn hay đồ đá vậy trời?!', 'Tui đói muốn xỉu rồi nè!', 'Nấu bằng niềm tin hả?!', 'Trời ơi là trời, lâu quá!'],
  leave: ['Thôi đi quán khác!', 'Một sao! Không bao giờ quay lại!', 'Quán dở ẹc!', 'Phí thời gian ghê!', 'Về! Về hết!'],
  happy: ['Ngon quá trời!', 'Tuyệt vời, năm sao!', 'Lần sau ghé nữa nha!', 'Đúng món rồi, cảm ơn nha!', 'Nhanh ghê, giỏi quá!'],
  wrong: ['Tui đâu có gọi món này!', 'Lộn món rồi em ơi!', 'Ủa ai gọi món này vậy?'],
  tam: ['Ủa con, dạo này sao rồi?', 'Khoan đi đã, cô kể cái này nè!', 'Con nhỏ nhà bên mới có bồ đó!', 'Hồi đó cô còn trẻ á…', 'Giá thịt dạo này mắc quá trời!', 'Con có người yêu chưa?'],
};
const ING_NAME = { tomato: 'cà chua', lettuce: 'rau', onion: 'hành', meat: 'thịt', bread: 'bánh mì' };
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const BASE_SPEED = 4.2, RADIUS = 0.28;

/* ======================= state ======================= */
let ws = null, myId = null, roomCode = null, hostId = null, cfg = null;
let phase = 'home';
let lobbyPlayers = [], lobbyInfo = null, lastEnd = null;
let resumingCode = null;
let snap = null;
let MAP = null, MW = 0, MH = 0, world = null;
const urlRoom = (new URLSearchParams(location.search).get('room') || '').toUpperCase().slice(0, 4);
const me = { x: 0, y: 0, a: 0, vx: 0, vy: 0, dashT: 0, dashCD: 0, inited: false };

/* ======================= audio ======================= */
let actx = null;
function ac() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
let noiseBuf = null;
function noise(dur, vol = 0.2, freq = 1500) {
  const a = ac(); if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const t = a.currentTime;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + dur);
}
const SFX = {
  pick: () => tone(520, 0.09, 'triangle', 0.14, 260),
  drop: () => tone(420, 0.09, 'triangle', 0.14, -160),
  chop: () => noise(0.05, 0.35, 2600),
  wash: () => tone(700 + Math.random() * 500, 0.07, 'sine', 0.06, 400),
  done: () => { tone(880, 0.08, 'sine', 0.12); tone(1320, 0.1, 'sine', 0.12, 0, 0.07); },
  serve: () => { tone(988, 0.12, 'sine', 0.2); tone(1319, 0.14, 'sine', 0.2, 0, 0.1); tone(1976, 0.3, 'sine', 0.16, 0, 0.2); },
  fail: () => { tone(220, 0.22, 'sawtooth', 0.1, -80); tone(150, 0.35, 'sawtooth', 0.1, -50, 0.18); },
  wrong: () => tone(180, 0.22, 'square', 0.09, -40),
  order: () => { tone(1568, 0.08, 'sine', 0.1); tone(2093, 0.15, 'sine', 0.1, 0, 0.08); },
  hand: () => { tone(1320, 0.07, 'triangle', 0.1); tone(1320, 0.07, 'triangle', 0.1, 0, 0.12); },
  door: () => { tone(1046, 0.25, 'sine', 0.12); tone(784, 0.4, 'sine', 0.12, 0, 0.25); },
  cooked: () => { tone(1046, 0.1, 'triangle', 0.13); tone(1046, 0.1, 'triangle', 0.13, 0, 0.14); },
  burnt: () => { for (let i = 0; i < 4; i++) tone(760, 0.08, 'square', 0.08, 0, i * 0.14); },
  shout: () => tone(260 + Math.random() * 160, 0.16, 'sawtooth', 0.07, 220),
  dash: () => noise(0.14, 0.18, 700),
  trash: () => noise(0.2, 0.25, 350),
  tick: () => tone(1200, 0.05, 'sine', 0.08),
  go: () => { tone(523, 0.12, 'square', 0.1); tone(784, 0.25, 'square', 0.1, 0, 0.12); },
  squeak: () => { tone(2200, 0.06, 'sine', 0.07, 600); tone(2600, 0.05, 'sine', 0.06, 400, 0.08); },
  whack: () => { noise(0.12, 0.45, 250); tone(140, 0.1, 'square', 0.1, -60); },
  alarm: () => { for (let i = 0; i < 3; i++) { tone(880, 0.18, 'sawtooth', 0.07, 0, i * 0.36); tone(660, 0.18, 'sawtooth', 0.07, 0, i * 0.36 + 0.18); } },
  whistle: () => { tone(2000, 0.15, 'sine', 0.1, 300); tone(2000, 0.35, 'sine', 0.1, -200, 0.2); },
  powerDown: () => tone(420, 0.7, 'sawtooth', 0.1, -360),
  powerUp: () => tone(120, 0.5, 'sawtooth', 0.08, 500),
  cash: () => { tone(1800, 0.06, 'square', 0.07); tone(2400, 0.22, 'sine', 0.1, 0, 0.06); },
  level: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'square', 0.08, 0, i * 0.1)),
  spray: () => noise(0.25, 0.22, 4000),
  clean: () => tone(1400, 0.06, 'sine', 0.06, 500),
};

/* ---------- giọng khách: dùng giọng đọc tiếng Việt của máy, không có thì lầm bầm ---------- */
let voiceOn = store.get('voice') !== '0';
let viVoice = null, lastBabble = 0, lastSpeak = 0;
function loadVoices() {
  try { viVoice = speechSynthesis.getVoices().find(v => /^vi/i.test(v.lang)) || null; } catch { viVoice = null; }
}
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function unlockSpeech() {
  try { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch { /* ignore */ }
}
function babble(len, pitch, angry) {
  const now = performance.now();
  if (now - lastBabble < 600) return;
  lastBabble = now;
  const n = clamp((len / 3) | 0, 3, 10);
  for (let i = 0; i < n; i++) {
    tone((angry ? 170 : 250) * pitch * (0.8 + Math.random() * 0.5), 0.07, angry ? 'sawtooth' : 'square', angry ? 0.06 : 0.045, (Math.random() - 0.5) * 90, i * (angry ? 0.065 : 0.08));
  }
}
function speak(text, pitch = 1, mood = 0, prio = false) {
  if (!voiceOn) return;
  const clean = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
  const now = performance.now();
  if (viVoice) {
    try {
      if (speechSynthesis.speaking) {
        if (!prio && now - lastSpeak < 4000) return;
        speechSynthesis.cancel();
      }
      const u = new SpeechSynthesisUtterance(clean);
      u.voice = viVoice; u.lang = viVoice.lang;
      u.rate = mood === 2 ? 1.3 : 1.12;
      u.pitch = clamp(pitch * (mood === 2 ? 0.85 : 1), 0.5, 1.8);
      speechSynthesis.speak(u);
      lastSpeak = now;
      return;
    } catch { /* fall through */ }
  }
  babble(clean.length, pitch, mood === 2);
}
$('#btnVoice').onclick = () => {
  voiceOn = !voiceOn;
  store.set('voice', voiceOn ? '1' : '0');
  $('#btnVoice').textContent = `🗣️ Giọng khách: ${voiceOn ? 'Bật' : 'Tắt'}`;
  if (voiceOn) { unlockSpeech(); speak('Xin chào!', 1.1, 3, true); }
};
$('#btnVoice').textContent = `🗣️ Giọng khách: ${voiceOn ? 'Bật' : 'Tắt'}`;

/* ======================= UI basics ======================= */
let toastT = 0;
function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show ' + kind;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.className = ''; }, 1900);
}
function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id); }
function goFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
    .catch(() => {});
}

/* ======================= networking ======================= */
function connect(first) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const sock = new WebSocket(`${proto}://${location.host}`);
  ws = sock;
  sock.onopen = () => send(first);
  sock.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (ws === sock) handle(m); };
  sock.onclose = () => {
    if (ws === sock) ws = null;
    if (sock.leaving) return;   // đã chủ động rời phòng, về màn hình chính rồi
    if (phase === 'home') { setBusy(false); toast('Không kết nối được server 😢', 'bad'); }
    else $('#disc').classList.remove('hidden');
  };
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

function handle(m) {
  switch (m.t) {
    case 'err': toast(m.msg, 'bad'); setBusy(false); resumingCode = null; break;
    case 'welcome':
      myId = m.id; roomCode = m.room; cfg = m;
      if (!world) buildWorld(m.map);
      history.replaceState(null, '', '?room=' + m.room);
      // mã phòng cũ đã có người dùng: server cấp mã mới, bỏ file lưu theo mã cũ
      if (resumingCode && resumingCode !== m.room) removeSave(resumingCode);
      resumingCode = null;
      buildRoleCards();
      renderShop(true);
      showLobby();
      break;
    case 'lobby':
      hostId = m.host; lobbyPlayers = m.players; lobbyInfo = m;
      renderLobby();
      if (m.state === 'lobby' && phase !== 'lobby') showLobby();
      break;
    case 'start': startPlaying(); break;
    case 's': onSnap(m); break;
    case 'ev': onEvent(m); break;
    case 'dayEnd': showDayEnd(m); break;
    case 'save': putSave(m.data); break;
    case 'closed': goHome(m.msg); break;
  }
}

/* ======================= lưu game (trên máy chủ phòng) ======================= */
const SAVES_KEY = 'bl:saves';
function loadSaves() { try { const l = JSON.parse(store.get(SAVES_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } }
function writeSaves(list) {
  // localStorage đầy thì bỏ bớt file cũ
  for (let n = list.length; n > 0; n--) {
    try { localStorage.setItem(SAVES_KEY, JSON.stringify(list.slice(0, n))); return; } catch { /* thử lại với ít file hơn */ }
  }
}
function putSave(s) {
  if (!s || !s.code) return;
  writeSaves([s, ...loadSaves().filter(x => x.code !== s.code)].slice(0, 5));
}
function removeSave(code) { writeSaves(loadSaves().filter(x => x.code !== code)); renderSaves(); }
function renderSaves() {
  const list = loadSaves();
  const box = $('#saves');
  box.classList.toggle('hidden', !list.length);
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="plabel">📂 Quán đã lưu (chỉ máy này)</div>' + list.map(s => {
    const when = new Date(s.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const mid = s.mid ? ` · đang dở, còn ${fmtTime(s.left)}` : '';
    return `<div class="save"><span><b>Phòng ${esc(s.code)} · Ngày ${s.day | 0}</b><small>💰 ${s.money | 0}${mid} · ${when}</small></span>` +
      `<button class="btn sm primary" data-play="${esc(s.code)}">▶</button><button class="btn sm" data-del="${esc(s.code)}">🗑</button></div>`;
  }).join('');
}
$('#saves').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.del) { if (confirm(`Xoá quán đã lưu ở phòng ${b.dataset.del}?`)) removeSave(b.dataset.del); return; }
  const s = loadSaves().find(x => x.code === b.dataset.play);
  if (!s) return;
  resumingCode = s.code;
  go({ t: 'resume', save: s });
});

// bị đưa ra khỏi phòng (chủ phòng thoát / mình tự rời)
function goHome(msg) {
  phase = 'home';
  if (ws) { ws.leaving = true; try { ws.close(); } catch { /* ignore */ } ws = null; }
  for (const id of ['#hud', '#controls', '#cd', '#evchips', '#shop', '#banner', '#shoutMenu', '#exitModal', '#help', '#disc']) $(id).classList.add('hidden');
  clearPlayers();
  snap = null; lobbyInfo = null; lastEnd = null; hostId = null;
  show('home');
  setBusy(false);
  renderSaves();
  camMode = 'overview';
  fitCamera();
  if (msg) toast(msg, 'good');
}

/* ======================= home ======================= */
const busyBtns = ['#btnCreate', '#btnJoin', '#btnJoinUrl'];
function setBusy(b) { for (const s of busyBtns) $(s).disabled = b; }
$('#nameIn').value = store.get('name') || '';
if (urlRoom) {
  $('#btnJoinUrl').classList.remove('hidden');
  $('#urlCode').textContent = urlRoom;
  $('.form').classList.add('has-url');
  $('#codeIn').value = urlRoom;
}
function go(msg) {
  const name = $('#nameIn').value.trim();
  if (!name) { toast('Nhập tên đã mày!', 'bad'); $('#nameIn').focus(); return; }
  store.set('name', name);
  msg.name = name;
  ac();
  unlockSpeech();
  goFullscreen();
  setBusy(true);
  if (ws && ws.readyState === 1) send(msg); else connect(msg);
}
$('#btnCreate').onclick = () => go({ t: 'create' });
$('#btnJoinUrl').onclick = () => go({ t: 'join', room: urlRoom });
$('#btnJoin').onclick = () => {
  const code = $('#codeIn').value.trim().toUpperCase();
  if (code.length < 4) { toast('Mã phòng có 4 chữ', 'bad'); return; }
  go({ t: 'join', room: code });
};
renderSaves();
$('#nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') (urlRoom ? $('#btnJoinUrl') : $('#btnCreate')).click(); });
$('#codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnJoin').click(); });

/* ======================= lobby ======================= */
const roomLink = () => `${location.origin}${location.pathname}?room=${roomCode}`;

function showLobby() {
  phase = 'lobby';
  setBusy(false);
  show('lobby');
  for (const id of ['#hud', '#controls', '#cd', '#evchips', '#shop', '#banner', '#exitModal']) $(id).classList.add('hidden');
  clearPlayers();
  snap = null; lastEnd = null;
  $('#roomCode').textContent = roomCode;
  $('#linkIn').value = roomLink();
  renderQR();
  renderLobby();
  fitCamera();
}

function renderQR() {
  const box = $('#qr');
  if (!window.qrcode) { box.textContent = ''; setTimeout(() => window.qrcode && renderQR(), 800); return; }
  const q = window.qrcode(0, 'M');
  q.addData(roomLink());
  q.make();
  box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
$('#qr').onclick = () => $('#qr').classList.toggle('big');

function buildRoleCards() {
  const box = $('#roles');
  box.innerHTML = '';
  for (const [k, R] of Object.entries(cfg.roles)) {
    const b = document.createElement('button');
    b.className = 'role';
    b.dataset.role = k;
    b.style.setProperty('--c', R.color);
    b.innerHTML = `<span class="e">${R.emoji}</span><b>${R.name}</b><small>${R.desc}</small><span class="cnt hidden"></span>`;
    b.onclick = () => { send({ t: 'role', role: k }); SFX.pick(); };
    box.appendChild(b);
  }
}

function renderLobby() {
  if (!cfg) return;
  $('#pcount').textContent = lobbyPlayers.length;
  $('#plist').innerHTML = lobbyPlayers.map(p => {
    const R = cfg.roles[p.role];
    return `<div class="pchip" style="--c:${R.color}"><span class="e">${R.emoji}</span><b>${esc(p.name)}</b>${p.id === hostId ? ' 👑' : ''}${p.id === myId ? ' <em>(mày)</em>' : ''}</div>`;
  }).join('');
  const mine = lobbyPlayers.find(p => p.id === myId);
  for (const b of document.querySelectorAll('.role')) {
    const k = b.dataset.role;
    b.classList.toggle('sel', mine?.role === k);
    const n = lobbyPlayers.filter(p => p.role === k).length;
    const c = b.querySelector('.cnt');
    c.textContent = n; c.classList.toggle('hidden', !n);
  }
  const isHost = hostId === myId;
  const L = lobbyInfo || {};
  $('#hostBox').classList.toggle('hidden', !isHost);
  $('#waitHost').classList.toggle('hidden', isHost);
  $('#btnNew').classList.toggle('hidden', !isHost || !(L.resume || (L.camp && L.camp.day > 1)));
  $('#btnLeave').textContent = isHost ? (L.camp ? '💾 Lưu & thoát' : '🚪 Đóng phòng') : '🚪 Rời phòng';
  if (L.resume) {
    $('#campInfo').innerHTML = `📂 Quán đang dở: <b>Ngày ${L.resume.day}</b>, còn ${fmtTime(L.resume.left)} · 💰 ${L.resume.money}`;
    $('#btnStart').textContent = `▶ CHƠI TIẾP · NGÀY ${L.resume.day}`;
  } else if (L.camp && (L.camp.day > 1 || L.camp.money)) {
    $('#campInfo').innerHTML = `📂 Quán của tụi mày: <b>Ngày ${L.camp.day}</b> · 💰 ${L.camp.money}`;
    $('#btnStart').textContent = `▶ VÀO BẾP · NGÀY ${L.camp.day}`;
  } else {
    $('#campInfo').innerHTML = '';
    $('#btnStart').textContent = '▶ VÀO BẾP! · NGÀY 1';
  }
  if (L.daily) $('#btnDaily').innerHTML = `🎯 Thử thách hôm nay: ${L.daily.icon} ${esc(L.daily.name)}<small>${esc(L.daily.desc)}${dailyBest(L.daily.date) ? ` · kỷ lục máy mày: 💰${dailyBest(L.daily.date)}` : ''}</small>`;
  // màn hết ngày
  const E = lastEnd;
  $('#endBtns').classList.toggle('hidden', !isHost);
  $('#endWait').classList.toggle('hidden', isHost);
  if (E) {
    $('#btnNext').textContent = E.mode === 'daily' ? '🔁 Chơi lại thử thách' : E.passed ? `▶ Sang ngày ${E.next}` : `🔁 Làm lại ngày ${E.day}`;
    $('#btnSaveExit').textContent = E.mode === 'camp' || L.camp ? '💾 Lưu & thoát' : '🚪 Đóng phòng';
  }
}

$('#btnStart').onclick = () => { send({ t: 'start', kind: 'camp' }); goFullscreen(); };
$('#btnDaily').onclick = () => { send({ t: 'start', kind: 'daily' }); goFullscreen(); };
$('#btnNew').onclick = () => { if (confirm('Mở quán mới từ ngày 1? Quán đang có sẽ bị ghi đè.')) { send({ t: 'start', kind: 'new' }); goFullscreen(); } };
$('#btnNext').onclick = () => send({ t: 'next' });
$('#btnToLobby').onclick = () => send({ t: 'lobby' });
$('#btnLeave').onclick = () => askExit();
$('#btnLeave2').onclick = () => askExit();
$('#btnSaveExit').onclick = () => askExit();
$('#btnExit').onclick = () => askExit();
$('#btnExitNo').onclick = () => $('#exitModal').classList.add('hidden');
$('#exitModal').onclick = e => { if (e.target.id === 'exitModal') $('#exitModal').classList.add('hidden'); };
$('#btnExitYes').onclick = () => { $('#exitModal').classList.add('hidden'); send({ t: 'exit' }); };
function askExit() {
  const isHost = hostId === myId, L = lobbyInfo || {};
  const camp = L.camp || snap?.mode === 'camp';
  $('#exitTitle').textContent = isHost ? (camp ? '💾 Lưu & thoát?' : '🚪 Đóng phòng?') : '🚪 Rời phòng?';
  $('#exitText').innerHTML = isHost
    ? `${camp ? 'Quán sẽ được lưu trên máy mày, lần sau vào lại ở màn hình chính.' : 'Thử thách hôm nay không lưu được.'}<br><b>Cả phòng sẽ thoát theo.</b>`
    : 'Mày rời phòng thì các bạn vẫn chơi tiếp. Muốn vào lại thì nhập mã phòng.';
  $('#btnExitYes').textContent = isHost ? (camp ? '💾 Lưu & thoát' : '🚪 Đóng phòng') : '🚪 Rời phòng';
  $('#exitModal').classList.remove('hidden');
}
const dailyBest = date => Number(store.get('bl:daily:' + date)) || 0;
$('#btnCopy').onclick = async () => {
  try { await navigator.clipboard.writeText(roomLink()); toast('Đã copy link! Dán vào nhóm chat đi 📋', 'good'); }
  catch { const i = $('#linkIn'); i.focus(); i.select(); toast('Giữ vào ô link để copy nha'); }
};
if (!navigator.share) $('#btnShare').classList.add('hidden');
$('#btnShare').onclick = () => navigator.share?.({ title: 'Bếp Loạn', text: `Vào bếp với tao! Phòng ${roomCode} 🍳`, url: roomLink() }).catch(() => {});
$('#btnRecipes').onclick = () => $('#help').classList.remove('hidden');
$('#btnHelp').onclick = () => $('#help').classList.remove('hidden');
$('#btnHelpClose').onclick = () => $('#help').classList.add('hidden');
$('#help').onclick = e => { if (e.target.id === 'help') $('#help').classList.add('hidden'); };
$('#btnFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else goFullscreen(); };
if (!document.documentElement.requestFullscreen) $('#btnFull').classList.add('hidden');

/* ======================= shop ======================= */
let shopKey = '', shopOpened = false;
const shopOpen = () => !$('#shop').classList.contains('hidden');
function renderShop(force) {
  if (!cfg) return;
  const money = snap?.money ?? 0;
  $('#shopMoney').textContent = `💰 ${money}`;
  const owned = k => {
    const it = cfg.shop[k];
    if (!snap) return false;
    if (it.cat === 'staff') return k === 'cat' ? !!snap.cat : snap.staff[k] > 0;
    if (it.cat === 'up' || k === 'license') return !!snap.up?.[k];
    return false;
  };
  const key = Object.keys(cfg.shop).map(k => `${owned(k) ? 1 : 0}${money >= cfg.shop[k].price ? 1 : 0}`).join('');
  if (!force && key === shopKey) return;
  shopKey = key;
  const sec = (cat, title) => `<div class="shop-sec">${title}</div><div class="shop-grid">` +
    Object.entries(cfg.shop).filter(([, it]) => it.cat === cat).map(([k, it]) => {
      const own = owned(k), cls = own ? 'own' : money < it.price ? 'no' : '';
      const wage = it.wage ? ` · lương ${it.wage}/phút` : '';
      return `<button class="sitem ${cls}" data-k="${k}"><span class="e">${it.icon}</span><span><b>${it.name}</b><small>${it.desc}${wage}</small></span><span class="pr">${own ? (it.cat === 'staff' ? 'Đang làm' : 'Đã có') : '💰' + it.price}</span></button>`;
    }).join('') + '</div>';
  $('#shopBody').innerHTML = sec('staff', '👷 Thuê nhân viên (trả lương mỗi phút, hết tiền là nghỉ)') + sec('item', '🧰 Đồ dùng') + sec('up', '⚙️ Nâng cấp vĩnh viễn');
}
$('#btnShop').onclick = () => {
  if (phase !== 'playing') return;
  shopOpened = true;
  $('#shoutMenu').classList.add('hidden');
  $('#shop').classList.remove('hidden');
  renderShop(true);
};
$('#btnShopClose').onclick = () => $('#shop').classList.add('hidden');
$('#shop').onclick = e => { if (e.target.id === 'shop') $('#shop').classList.add('hidden'); };
$('#shopBody').addEventListener('click', e => {
  const b = e.target.closest('.sitem');
  if (!b || b.classList.contains('own')) return;
  if (b.classList.contains('no')) { toast('Không đủ tiền 💸', 'bad'); return; }
  send({ t: 'buy', k: b.dataset.k });
});

/* ======================= banner ======================= */
let bannerT = 0;
function banner(title, sub = '', cls = '', ms = 2600) {
  const el = $('#banner');
  el.className = cls;
  el.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`;
  void el.offsetWidth;
  clearTimeout(bannerT);
  bannerT = setTimeout(() => el.classList.add('hidden'), ms);
}

/* ======================= game flow ======================= */
let lastCd = 0, lastSec = 999, lastMoney = 0;
function startPlaying() {
  phase = 'playing';
  lastEnd = null;
  me.stun = 0;
  show(null);
  $('#help').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  $('#controls').classList.remove('hidden');
  $('#evchips').classList.remove('hidden');
  me.inited = false; me.vx = me.vy = 0;
  lastCd = 0; lastSec = 999; lastMoney = 0; shopOpened = false;
  camMode = 'follow';
  $('#btnMap').classList.remove('on');
  for (const el of orderEls.values()) el.remove();
  orderEls.clear();
  clearPlayers();
  fitCamera();
}

function showDayEnd(m) {
  phase = 'ended';
  lastEnd = m;
  for (const id of ['#controls', '#cd', '#shoutMenu', '#shop', '#evchips', '#exitModal']) $(id).classList.add('hidden');
  show('end');
  const sub = $('#endSub');
  let good;
  if (m.mode === 'daily') {
    const key = 'bl:daily:' + m.daily.date, best = dailyBest(m.daily.date), isNew = m.earned > best;
    if (isNew) store.set(key, String(m.earned));
    $('#endTitle').textContent = m.reason === 'rep' ? '🚫 BỊ ĐÓNG CỬA!' : '🎯 XONG THỬ THÁCH!';
    sub.className = isNew ? 'good' : '';
    sub.innerHTML = `${m.daily.icon} ${esc(m.daily.name)} · ${isNew ? '🏅 KỶ LỤC MỚI (máy mày)!' : `Kỷ lục máy mày: 💰${best}`}`;
    $('#stars').innerHTML = '';
    good = isNew;
  } else {
    $('#endTitle').textContent = m.passed ? `🌙 XONG NGÀY ${m.day}!` : m.reason === 'rep' ? '🚫 BỊ ĐÓNG CỬA!' : `❌ TRƯỢT NGÀY ${m.day}`;
    sub.className = m.passed ? 'good' : 'bad';
    sub.textContent = m.passed ? `Đạt chỉ tiêu 🎯 ${m.target}💰 · mai là ngày ${m.next}` : m.reason === 'rep' ? 'Uy tín về 0, khách bỏ hết 😭 Làm lại ngày này nha' : `Chưa đủ chỉ tiêu 🎯 ${m.target}💰, làm lại ngày này nha`;
    $('#stars').innerHTML = [0, 1, 2].map(i => `<span class="${i < m.stars ? '' : 'off'}" style="animation-delay:${0.2 + i * 0.25}s">⭐</span>`).join('');
    good = m.passed;
  }
  $('#finalScore').textContent = `💰 ${m.earned}`;
  const thr = m.thresholds?.length ? `<br><small>Mốc sao: ${m.thresholds.join(' / ')} 💰 · Quỹ quán: 💰${m.money}</small>` : '';
  $('#endStats').innerHTML = `🍽️ ${m.served} món · 😡 ${m.failed} khách bỏ về · ⏱ ${fmtTime(m.elapsed)} · ${m.events} sự kiện${thr}`;
  $('#titles').innerHTML = m.titles.map((t, i) => {
    const R = cfg.roles[t.role] || { color: '#999' };
    return `<div class="tcard" style="--c:${R.color};animation-delay:${0.3 + i * 0.12}s">${t.mvp ? '<span class="mvp">👑 MVP</span>' : ''}<span class="ti">${t.icon}</span>` +
      `<span class="tt">${esc(t.title)}</span><span class="tn">${esc(t.name)}${t.id === myId ? ' (mày)' : ''}</span><span class="td">${esc(t.desc)}</span></div>`;
  }).join('');
  renderLobby();
  camMode = 'overview';
  fitCamera();
  if (good) SFX.level(); else SFX.fail();
}

/* ======================= THREE setup ======================= */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2b1d14');
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 300);
const hemi = new THREE.HemisphereLight(0xfff1dc, 0x6b5040, 1.5);
scene.add(hemi);
let lightK = 1;
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 11, bottom: -11, near: 1, far: 50 });
scene.add(sun, sun.target);

const matCache = new Map(), geoCache = new Map();
function M(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts }));
  return matCache.get(key);
}
const G = (key, fn) => { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); };
const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const RB = (w, h, d, r = 0.06) => G(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
const cyl = (rt, rb, h, s = 20) => G(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const sph = (r, s = 16) => G(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(8, (s * 0.75) | 0)));
const torus = (r, t) => G(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 8, 24));
const planeG = size => G('pl' + size, () => new THREE.PlaneGeometry(size, size));
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const texCache = new Map();
function emojiMat(e, opacity = 1) {
  const key = e + opacity;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '92px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(e, 64, 72);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity, depthWrite: false });
  texCache.set(key, m);
  return m;
}
function canvasMat(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, ...opts });
}
function clothMat(num) {
  return canvasMat(128, 128, (g) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#ffffff' : '#e8504a'; g.fillRect(x * 16, y * 16, 16, 16); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(100, 100, 22, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a2618'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#3a2618'; g.font = 'bold 30px "Baloo 2",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(num), 100, 103);
  });
}

/* ======================= world ======================= */
const tiles = [];          // per tile index: { type, anchor, vis, key, burner, top, fireVis }
const tileState = [];      // per tile index: { item, n, prog, fire, ext }
let solid = [];
let highlight = null, ratRing = null;
const animated = new Set();
const tableByTile = new Map();

function buildWorld(map) {
  MAP = map; MH = map.length; MW = map[0].length;
  world = new THREE.Group();
  scene.add(world);
  solid = map.map(row => [...row].map(ch => ch !== '.' && ch !== 'E'));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), M('#3a2a20'));
  ground.rotation.x = -Math.PI / 2; ground.position.set(MW / 2, -0.02, MH / 2); ground.receiveShadow = true;
  world.add(ground);

  // sàn: bếp lát gạch caro, phòng ăn lát gỗ
  const S = 32;
  const fc = document.createElement('canvas'); fc.width = MW * S; fc.height = MH * S;
  const fg = fc.getContext('2d');
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    if (i < 15) {
      fg.fillStyle = (i + j) % 2 ? '#e6d5ba' : '#f4ead8';
      fg.fillRect(i * S, j * S, S, S);
      fg.strokeStyle = 'rgba(110,80,50,.25)'; fg.lineWidth = 1.5; fg.strokeRect(i * S, j * S, S, S);
    } else {
      for (let k = 0; k < 4; k++) {
        const shade = 150 + ((i * 7 + j * 13 + k * 5) % 5) * 8;
        fg.fillStyle = `rgb(${shade + 40},${shade - 5},${shade - 60})`;
        fg.fillRect(i * S, j * S + k * 8, S, 8);
        fg.fillStyle = 'rgba(80,45,20,.35)';
        fg.fillRect(i * S, j * S + k * 8 + 7, S, 1);
        fg.fillRect(i * S + ((k * 11 + i * 5) % S), j * S + k * 8, 1, 8);
      }
    }
  }
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace; ft.anisotropy = 4;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(MW / 2, 0, MH / 2); floor.receiveShadow = true;
  world.add(floor);

  // tường sau + 2 bên
  world.add(mesh(box(MW + 0.6, 1.7, 0.3), M('#e3cfb2'), MW / 2, 0.85, -0.15));
  world.add(mesh(box(MW + 0.62, 0.14, 0.32), M('#c2643c'), MW / 2, 1.2, -0.15));
  world.add(mesh(box(0.3, 1.2, MH + 0.3), M('#d6c0a0'), -0.15, 0.6, MH / 2 - 0.15));

  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    tileState[j * MW + i] = { item: null, n: 0, prog: 0, fire: 0, ext: 0 };
    const ch = map[j][i];
    if (ch !== '.') buildStation(ch, i, j);
  }

  highlight = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.4, depthWrite: false }));
  highlight.rotation.x = -Math.PI / 2;
  highlight.visible = false;
  world.add(highlight);
  ratRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 24), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.85, depthWrite: false }));
  ratRing.rotation.x = -Math.PI / 2;
  ratRing.visible = false;
  world.add(ratRing);

  camC.set(MW / 2, 0, MH / 2);
  resize();
}

function buildStation(ch, i, j) {
  const g = new THREE.Group();
  g.position.set(i + 0.5, 0, j + 0.5);
  world.add(g);
  const info = { type: TYPE[ch], anchor: new THREE.Group(), vis: null, fireVis: null, key: '', burner: null, top: 0.9 };
  const base = (body = '#a86e45', top = '#e2bd8c') => {
    g.add(mesh(RB(0.98, 0.86, 0.98), M(body), 0, 0.43, 0));
    g.add(mesh(box(1, 0.06, 1), M(top), 0, 0.87, 0));
  };
  const plane = (mat, size, y, x = 0, z = 0) => {
    const p = new THREE.Mesh(planeG(size), mat);
    p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); g.add(p); return p;
  };
  const metal = M('#c9d0d8', { metalness: 0.6, roughness: 0.35 });

  switch (ch) {
    case '#': case 'p': base(); break;
    case 'T': case 'L': case 'O': case 'M': case 'B': {
      g.add(mesh(RB(0.98, 0.86, 0.98), M('#9b6438'), 0, 0.43, 0));
      for (let k = 0; k < 3; k++) g.add(mesh(box(0.86, 0.07, 0.03), M('#74461f'), 0, 0.18 + k * 0.24, 0.49));
      g.add(mesh(box(1, 0.06, 1), M('#c99a68'), 0, 0.87, 0));
      plane(emojiMat(EMO[CRATE[ch]]), 0.78, 0.905);
      const f = new THREE.Mesh(planeG(0.42), emojiMat(EMO[CRATE[ch]]));
      f.position.set(0, 0.5, 0.515); g.add(f);
      break;
    }
    case 'C':
      base();
      g.add(mesh(box(0.72, 0.05, 0.58), M('#e2b47c'), 0, 0.925, 0));
      g.add(mesh(box(0.06, 0.015, 0.26), metal, 0.42, 0.91, -0.08));
      g.add(mesh(box(0.06, 0.035, 0.13), M('#2b2b2b'), 0.42, 0.915, 0.14));
      info.top = 0.95;
      break;
    case 'S': case 'F': {
      g.add(mesh(RB(0.98, 0.86, 0.98), M('#59616d'), 0, 0.43, 0));
      g.add(mesh(box(1, 0.06, 1), M('#2e3238'), 0, 0.87, 0));
      const bm = new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.5, emissive: '#ff4d00', emissiveIntensity: 0 });
      const burner = mesh(torus(0.22, 0.03), bm, 0, 0.905, 0);
      burner.rotation.x = -Math.PI / 2;
      g.add(burner);
      info.burner = burner;
      for (const kx of [-0.22, 0.22]) { const k = mesh(cyl(0.06, 0.06, 0.05, 12), M('#222'), kx, 0.62, 0.5); k.rotation.x = Math.PI / 2; g.add(k); }
      g.add(mesh(box(0.7, 0.1, 0.02), M('#1d1f23'), 0, 0.32, 0.495));
      info.top = 0.93;
      break;
    }
    case 'W':
      base('#8ea2b4', '#dfe7ee');
      g.add(mesh(box(0.78, 0.03, 0.66), M('#5c86a8', { roughness: 0.2 }), 0, 0.895, 0.02));
      g.add(mesh(cyl(0.035, 0.035, 0.32, 10), metal, 0, 1.05, -0.4));
      g.add(mesh(box(0.05, 0.05, 0.22), metal, 0, 1.2, -0.3));
      info.top = 0.88;
      break;
    case 'P': {
      // quầy ra món: inox, có chuông và đèn giữ nóng
      g.add(mesh(RB(0.98, 0.86, 0.98), M('#b8c2cc', { metalness: 0.5, roughness: 0.35 }), 0, 0.43, 0));
      g.add(mesh(box(1, 0.06, 1), M('#e8edf2', { metalness: 0.4, roughness: 0.3 }), 0, 0.87, 0));
      for (const sx of [-0.5, 0.5]) { const f = new THREE.Mesh(planeG(0.42), emojiMat('🛎️')); f.position.set(sx * 1.03, 0.5, 0); f.rotation.y = sx * Math.PI / 2; g.add(f); }
      if (j === 4) {
        const b = mesh(sph(0.08, 14), M('#e8b923', { metalness: 0.7, roughness: 0.3 }), 0.32, 0.93, 0.32); b.scale.y = 0.7; g.add(b);
      }
      g.add(mesh(box(0.06, 0.6, 0.06), metal, 0, 1.2, -0.45));
      const lamp = mesh(box(0.7, 0.06, 0.25), M('#ff8c3a', { emissive: '#ff6a00', emissiveIntensity: 0.6 }), 0, 1.5, -0.3);
      g.add(lamp);
      break;
    }
    case 'R':
      base('#8ea2b4', '#dfe7ee');
      for (let k = -2; k <= 2; k++) g.add(mesh(cyl(0.015, 0.015, 0.34, 6), metal, k * 0.13, 1.06, -0.36));
      g.add(mesh(box(0.66, 0.03, 0.04), metal, 0, 1.22, -0.36));
      break;
    case 'G':
      g.add(mesh(cyl(0.38, 0.32, 0.8, 20), M('#5d6670'), 0, 0.4, 0));
      g.add(mesh(cyl(0.41, 0.41, 0.07, 20), M('#3f454d'), 0, 0.83, 0));
      plane(emojiMat('🗑️'), 0.5, 0.87);
      info.top = 0.87;
      break;
    case 'w': {
      // tường phòng ăn: hàng sau cao có cửa sổ, hàng trước thấp có bồn cây
      if (j === 0) {
        g.add(mesh(box(1, 1.5, 1), M('#efe0c4'), 0, 0.75, 0));
        g.add(mesh(box(1.01, 0.12, 1.01), M('#8b5a2b'), 0, 0.5, 0));
        if (i % 3 === 1) { g.add(mesh(box(0.6, 0.5, 0.02), M('#9fd3f0', { roughness: 0.1 }), 0, 1.05, 0.51)); g.add(mesh(box(0.66, 0.06, 0.06), M('#8b5a2b'), 0, 0.78, 0.52)); }
      } else if (j === MH - 1) {
        g.add(mesh(box(1, 0.4, 1), M('#8b5a2b'), 0, 0.2, 0));
        const bush = mesh(sph(0.36, 10), M(i % 2 ? '#4f9d3a' : '#5fae44'), 0, 0.5, 0); bush.scale.set(1.25, 0.6, 1.1); g.add(bush);
        if (i % 4 === 0) g.add(mesh(sph(0.07, 8), M('#ff6b8b'), 0.15, 0.68, 0.2));
      } else {
        g.add(mesh(box(1, 1.0, 1), M('#efe0c4'), 0, 0.5, 0));
        g.add(mesh(box(1.01, 0.1, 1.01), M('#8b5a2b'), 0, 0.35, 0));
        if (j % 2 === 0) g.add(mesh(box(0.02, 0.4, 0.5), M('#9fd3f0', { roughness: 0.1 }), -0.51, 0.7, 0));
      }
      return;
    }
    case 'E': {
      // cửa ra vào: khung cửa + thảm chùi chân
      const mat = new THREE.Mesh(planeG(0.9), canvasMat(128, 128, (cg) => {
        cg.fillStyle = '#8b3a2a'; cg.fillRect(0, 0, 128, 128);
        cg.fillStyle = '#f3d27a'; cg.font = 'bold 22px "Baloo 2",sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
        cg.save(); cg.translate(64, 64); cg.rotate(Math.PI / 2); cg.fillText('WELCOME', 0, 0); cg.restore();
      }));
      mat.rotation.x = -Math.PI / 2; mat.position.y = 0.01; mat.receiveShadow = true; g.add(mat);
      for (const z of [-0.5, 0.5]) g.add(mesh(box(0.2, 1.4, 0.12), M('#6b3f1f'), 0.4, 0.7, z));
      g.add(mesh(box(0.22, 0.16, 1.12), M('#6b3f1f'), 0.4, 1.42, 0));
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ map: emojiMat('🍳').map, transparent: true }));
      sign.position.set(0.3, 1.75, 0); sign.rotation.y = -Math.PI / 2; g.add(sign);
      return;
    }
    case 'h': {
      const back = map(i + 1, j) === 't' ? -1 : 1;     // lưng ghế quay ra xa bàn
      g.add(mesh(box(0.5, 0.06, 0.5), M('#8b5a2b'), 0, 0.42, 0));
      g.add(mesh(box(0.44, 0.04, 0.44), M('#c0392b'), 0, 0.46, 0));
      for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(mesh(box(0.05, 0.42, 0.05), M('#6b3f1f'), lx, 0.21, lz));
      g.add(mesh(box(0.06, 0.5, 0.5), M('#8b5a2b'), back * 0.23, 0.7, 0));
      info.top = 0.48;
      break;
    }
    case 't': {
      const num = [...MAP.join('')].slice(0, j * MW + i + 1).filter(c => c === 't').length;
      g.add(mesh(cyl(0.08, 0.2, 0.7, 10), M('#6b3f1f'), 0, 0.35, 0));
      g.add(mesh(box(0.92, 0.06, 0.92), clothMat(num), 0, 0.73, 0));
      g.add(mesh(box(0.96, 0.03, 0.96), M('#e8504a'), 0, 0.69, 0));
      info.top = 0.76;
      info.num = num;
      break;
    }
  }
  info.anchor.position.set(i + 0.5, info.top, j + 0.5);
  world.add(info.anchor);
  tiles[j * MW + i] = info;
}
const map = (x, y) => (x >= 0 && y >= 0 && x < MW && y < MH ? MAP[y][x] : '');

/* ---------- item meshes ---------- */
function ingMesh(t, s) {
  const g = new THREE.Group();
  if (s === 'raw') {
    if (t === 'tomato') {
      g.add(mesh(sph(0.16), M('#e0322a'), 0, 0.15, 0));
      g.add(mesh(cyl(0.02, 0.02, 0.07, 6), M('#3d8b2f'), 0, 0.32, 0));
      g.add(mesh(cyl(0.08, 0.08, 0.012, 5), M('#4caf3a'), 0, 0.3, 0));
    } else if (t === 'lettuce') {
      const a = mesh(sph(0.19), M('#4fae32'), 0, 0.16, 0); a.scale.set(1, 0.85, 1); g.add(a);
      g.add(mesh(sph(0.12), M('#a5e070'), 0.06, 0.25, 0.05));
      g.add(mesh(sph(0.1), M('#7fd04f'), -0.08, 0.24, -0.02));
    } else if (t === 'onion') {
      g.add(mesh(sph(0.15), M('#a95aa8'), 0, 0.15, 0));
      g.add(mesh(G('onc', () => new THREE.ConeGeometry(0.06, 0.14, 8)), M('#c88bc6'), 0, 0.32, 0));
    } else if (t === 'meat') {
      g.add(mesh(RB(0.36, 0.12, 0.26, 0.04), M('#e06a6a'), 0, 0.06, 0));
      g.add(mesh(box(0.3, 0.125, 0.04), M('#f7dcdc'), 0, 0.06, 0.05));
    } else if (t === 'bread') {
      const b = mesh(G('cap', () => new THREE.CapsuleGeometry(0.09, 0.3, 6, 12)), M('#d39a4f'), 0, 0.09, 0);
      b.rotation.z = Math.PI / 2; b.rotation.y = 0.4; g.add(b);
    }
  } else {
    if (t === 'tomato') {
      for (const [x, z] of [[-0.08, -0.04], [0.08, -0.05], [0, 0.08]]) {
        g.add(mesh(cyl(0.09, 0.09, 0.04, 14), M('#e0322a'), x, 0.02, z));
        g.add(mesh(cyl(0.07, 0.07, 0.042, 14), M('#ff8a70'), x, 0.022, z));
      }
    } else if (t === 'lettuce') {
      [[-0.1, -0.05, 0.3], [0.08, -0.07, 1.2], [0, 0.08, 2.1], [0.1, 0.07, 0.8], [-0.08, 0.07, 2.6], [0, -0.01, 1.7]].forEach(([x, z, r], k) => {
        const m = mesh(box(0.12, 0.03, 0.09), M(k % 2 ? '#a5e070' : '#4fae32'), x, 0.02 + (k % 3) * 0.015, z);
        m.rotation.y = r; g.add(m);
      });
    } else if (t === 'onion') {
      for (const [x, z] of [[-0.07, -0.04], [0.08, -0.03], [0, 0.08]]) { const m = mesh(torus(0.07, 0.022), M('#d9a6d6'), x, 0.025, z); m.rotation.x = -Math.PI / 2; g.add(m); }
    } else if (t === 'meat') {
      for (const [x, z] of [[-0.07, -0.06], [0.07, -0.06], [-0.07, 0.07], [0.07, 0.07]]) g.add(mesh(box(0.11, 0.08, 0.11), M('#e06a6a'), x, 0.04, z));
    } else if (t === 'bread') {
      for (const [x, z] of [[-0.09, 0], [0.02, -0.04], [0.11, 0.05]]) {
        g.add(mesh(cyl(0.085, 0.085, 0.05, 12), M('#c98a3e'), x, 0.025, z));
        g.add(mesh(cyl(0.07, 0.07, 0.052, 12), M('#f3dcae'), x, 0.026, z));
      }
    }
  }
  return g;
}
function steak(burnt) {
  const g = new THREE.Group();
  g.add(mesh(RB(0.3, 0.08, 0.22, 0.03), M(burnt ? '#1c1c1c' : '#7a4325'), 0, 0.04, 0));
  if (!burnt) for (const x of [-0.07, 0, 0.07]) g.add(mesh(box(0.02, 0.082, 0.2), M('#4a2512'), x, 0.041, 0));
  return g;
}
function plateMesh(c) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.28, 0.22, 0.045, 24), M('#fbfbf7'), 0, 0.022, 0));
  g.add(mesh(cyl(0.2, 0.2, 0.047, 24), M('#ebe8de'), 0, 0.023, 0));
  if (c.length && c[0].startsWith('soup')) {
    g.add(mesh(cyl(0.21, 0.14, 0.15, 20), M('#ffffff'), 0, 0.12, 0));
    g.add(mesh(cyl(0.19, 0.19, 0.02, 20), M(c[0] === 'soupT' ? '#d8452c' : '#e8b94a'), 0, 0.185, 0));
  } else {
    const offs = [[-0.08, -0.05], [0.09, -0.03], [0, 0.09]];
    c.forEach((x, k) => {
      const m = x === 'meat' ? steak() : ingMesh(x, 'chopped');
      m.scale.setScalar(0.8);
      m.position.set(offs[k][0], 0.045, offs[k][1]);
      g.add(m);
    });
  }
  return g;
}
function plateStack(n, dirty) {
  const g = new THREE.Group();
  for (let k = 0; k < n; k++) {
    g.add(mesh(cyl(0.28, 0.22, 0.045, 24), M(dirty ? '#d6cdb9' : '#fbfbf7'), 0, 0.022 + k * 0.05, 0));
    if (dirty) {
      g.add(mesh(cyl(0.06, 0.06, 0.047, 8), M('#8b6b3d'), 0.08 - (k % 2) * 0.12, 0.024 + k * 0.05, 0.05));
      g.add(mesh(cyl(0.04, 0.04, 0.047, 8), M('#6e8b3d'), -0.07, 0.024 + k * 0.05, -0.06 + (k % 2) * 0.1));
    }
  }
  return g;
}
const smokeMat = new THREE.MeshBasicMaterial({ color: '#777', transparent: true, opacity: 0.5, depthWrite: false });
const blackSmoke = new THREE.MeshBasicMaterial({ color: '#222', transparent: true, opacity: 0.6, depthWrite: false });
function addSmoke(g, mat, base) {
  const puffs = [0, 1, 2].map(() => { const m = new THREE.Mesh(sph(0.09, 8), mat); g.add(m); return m; });
  const prev = g.userData.tick;
  g.userData.tick = t => {
    prev?.(t);
    puffs.forEach((m, k) => {
      const f = (t * 0.7 + k / 3) % 1;
      m.position.set(Math.sin(t * 2 + k * 2) * 0.08, base + f * 0.7, Math.cos(t * 1.5 + k) * 0.05);
      m.scale.setScalar(0.6 + f * 1.4);
    });
  };
}
function addBubbles(g, y, color) {
  const bub = [0, 1, 2, 3].map(k => { const m = new THREE.Mesh(sph(0.035, 8), M(color)); g.add(m); m.position.set(Math.cos(k * 1.7) * 0.12, y, Math.sin(k * 1.7) * 0.12); return m; });
  const prev = g.userData.tick;
  g.userData.tick = t => { prev?.(t); bub.forEach((m, k) => { const f = (t * 1.6 + k * 0.27) % 1; m.position.y = y + f * 0.04; m.scale.setScalar(Math.sin(f * Math.PI) + 0.01); }); };
}
function contStatus(c) {
  const C = cfg.cook[c.k];
  const full = c.c.length === (c.k === 'pot' ? 3 : 1);
  if (c.burnt) return 'burnt';
  if (!full) return 'fill';
  if (c.p < C.cook) return 'cooking';
  if (c.p >= C.cook + C.burn * 0.5) return 'warn';
  return 'done';
}
function potMesh(c, st) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.25, 0.22, 0.26, 20), M('#9aa3ad', { metalness: 0.55, roughness: 0.35 }), 0, 0.13, 0));
  const rim = mesh(torus(0.25, 0.02), M('#7d858e', { metalness: 0.6, roughness: 0.3 }), 0, 0.26, 0); rim.rotation.x = -Math.PI / 2; g.add(rim);
  for (const x of [-0.3, 0.3]) g.add(mesh(box(0.12, 0.04, 0.07), M('#2c2f33'), x, 0.22, 0));
  if (c.c.length) {
    const lvl = 0.07 + 0.055 * c.c.length;
    const isT = c.c[0] === 'tomato';
    const col = st === 'burnt' ? '#1b1b1b' : st === 'fill' ? (isT ? '#f06a52' : '#d9a6d6') : st === 'cooking' ? (isT ? '#e4583c' : '#e7c27a') : (isT ? '#d8452c' : '#e8b94a');
    g.add(mesh(cyl(0.215, 0.215, 0.02, 20), M(col), 0, lvl, 0));
    if (st === 'cooking' || st === 'done' || st === 'warn') addBubbles(g, lvl + 0.01, isT ? '#ff9a7a' : '#fff0b8');
  }
  if (st === 'warn') addSmoke(g, smokeMat, 0.3);
  if (st === 'burnt') addSmoke(g, blackSmoke, 0.3);
  return g;
}
function panMesh(c, st) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.27, 0.23, 0.06, 20), M('#2b2b2b', { metalness: 0.4, roughness: 0.5 }), 0, 0.03, 0));
  g.add(mesh(box(0.06, 0.04, 0.3), M('#1a1a1a'), 0, 0.05, 0.38));
  if (c.c.length) {
    let m;
    if (st === 'fill') m = ingMesh('meat', 'chopped');
    else if (st === 'cooking') { m = steak(); m.children[0].material = M('#b5654a'); }
    else m = steak(st === 'burnt');
    m.position.y = 0.05; g.add(m);
  }
  if (st === 'warn') addSmoke(g, smokeMat, 0.15);
  if (st === 'burnt') addSmoke(g, blackSmoke, 0.15);
  return g;
}
function extMesh() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.09, 0.09, 0.36, 14), M('#d62828'), 0, 0.18, 0));
  g.add(mesh(cyl(0.05, 0.06, 0.07, 10), M('#222'), 0, 0.39, 0));
  g.add(mesh(box(0.16, 0.03, 0.04), M('#222'), 0.07, 0.43, 0));
  const hose = mesh(cyl(0.02, 0.02, 0.22, 6), M('#222'), 0.1, 0.3, 0.06); hose.rotation.z = 0.3; g.add(hose);
  g.add(mesh(box(0.1, 0.08, 0.005), M('#ffffff'), 0, 0.2, 0.09));
  return g;
}
function mopMesh() {
  const g = new THREE.Group();
  const stick = mesh(cyl(0.025, 0.025, 0.8, 8), M('#b0753c'), -0.05, 0.06, 0); stick.rotation.z = Math.PI / 2; g.add(stick);
  g.add(mesh(box(0.08, 0.1, 0.32), M('#3b82f6'), 0.37, 0.05, 0));
  for (let k = -2; k <= 2; k++) g.add(mesh(box(0.1, 0.03, 0.04), M('#e8eef5'), 0.44, 0.02, k * 0.06));
  return g;
}
const fireMats = [new THREE.MeshBasicMaterial({ color: '#ff5a1f' }), new THREE.MeshBasicMaterial({ color: '#ffb31f' }), new THREE.MeshBasicMaterial({ color: '#fff27a' })];
function fireMesh() {
  const g = new THREE.Group();
  const flames = [];
  for (const [x, z, h, mi] of [[0, 0, 0.6, 0], [-0.22, 0.1, 0.42, 0], [0.2, -0.12, 0.45, 0], [0.08, 0.2, 0.35, 1], [-0.1, -0.18, 0.36, 1], [0, 0, 0.3, 2]]) {
    const f = new THREE.Mesh(G('fl' + h, () => new THREE.ConeGeometry(0.14, h, 7)), fireMats[mi]);
    f.position.set(x, h / 2, z); g.add(f); flames.push([f, h, Math.random() * 6]);
  }
  g.userData.tick = t => {
    for (const [f, h, o] of flames) { const k = 0.75 + Math.abs(Math.sin(t * 9 + o)) * 0.45; f.scale.set(1, k, 1); f.position.y = (h * k) / 2; }
  };
  return g;
}
function itemKey(it) {
  if (!it) return '';
  switch (it.k) {
    case 'ing': return 'i' + it.t + it.s;
    case 'plate': return 'p' + it.c.join(',');
    case 'dirty': return 'd' + Math.min(it.n, 5);
    case 'ext': return 'x';
    case 'mop': return 'm';
    default: return it.k + it.c.join(',') + contStatus(it);
  }
}
function itemVisual(it) {
  switch (it.k) {
    case 'ing': return ingMesh(it.t, it.s);
    case 'plate': return plateMesh(it.c);
    case 'dirty': return plateStack(Math.min(it.n, 5), true);
    case 'pot': return potMesh(it, contStatus(it));
    case 'pan': return panMesh(it, contStatus(it));
    case 'ext': return extMesh();
    case 'mop': return mopMesh();
  }
  return new THREE.Group();
}
function tableVisual(tb) {
  const g = new THREE.Group();
  const offs = [[-0.2, -0.15], [0.2, 0.15], [-0.2, 0.18], [0.2, -0.18]];
  tb.f.forEach((k, n) => {
    const m = plateMesh(cfg.recipes[k].parts);
    m.scale.setScalar(0.75);
    m.position.set(offs[n % 4][0], 0, offs[n % 4][1]);
    g.add(m);
  });
  if (tb.d) { const s = plateStack(Math.min(tb.d, 4), true); s.scale.setScalar(0.8); g.add(s); }
  return g;
}

function updateTileVisual(i) {
  const info = tiles[i];
  if (!info) return;
  const s = tileState[i];
  let key, make;
  if (info.type === 'sink') { key = 'k' + Math.min(s.n, 4); make = () => plateStack(Math.min(s.n, 4), true); }
  else if (info.type === 'rack') { key = 'r' + Math.min(s.n, 6); make = () => plateStack(Math.min(s.n, 6), false); }
  else if (info.type === 'table') {
    const tb = tableByTile.get(i);
    key = tb && (tb.f.length || tb.d) ? 'tb' + tb.f.join(',') + '|' + Math.min(tb.d, 4) : '';
    make = () => tableVisual(tb);
  } else if (info.type === 'chair' || info.type === 'wall') return;
  else { key = itemKey(s.item); make = () => itemVisual(s.item); }
  if (info.burner) {
    const st = s.item ? contStatus(s.item) : 'fill';
    info.burner.material.emissiveIntensity = (st === 'cooking' || st === 'done' || st === 'warn') && !snap?.out ? 1.4 : 0;
  }
  if (!!s.fire !== !!info.fireVis) {
    if (info.fireVis) { info.anchor.remove(info.fireVis); animated.delete(info.fireVis); info.fireVis = null; }
    else { info.fireVis = fireMesh(); info.anchor.add(info.fireVis); animated.add(info.fireVis); }
  }
  if (key === info.key) return;
  info.key = key;
  if (info.vis) { info.anchor.remove(info.vis); animated.delete(info.vis); }
  info.vis = key && !/^[kr]0$/.test(key) ? make() : null;
  if (info.vis) { info.anchor.add(info.vis); if (info.vis.userData.tick) animated.add(info.vis); }
}

/* ---------- người: đầu bếp, nhân viên, khách, thanh tra ---------- */
function makeHuman({ body, band = body, hat = 'chef', apron = '#ffffff', scale = 1.18 }) {
  const g = new THREE.Group(), torso = new THREE.Group();
  g.add(torso);
  const skin = M('#f5cfa6');
  const legL = mesh(cyl(0.07, 0.07, 0.16, 8), M('#3b3346'), -0.09, 0.08, 0);
  const legR = mesh(cyl(0.07, 0.07, 0.16, 8), M('#3b3346'), 0.09, 0.08, 0);
  g.add(legL, legR);
  torso.add(mesh(cyl(0.2, 0.25, 0.42, 18), M(body), 0, 0.36, 0));
  if (apron) { const ap = mesh(box(0.24, 0.26, 0.02), M(apron), 0, 0.31, 0.235); ap.rotation.x = -0.12; torso.add(ap); }
  torso.add(mesh(sph(0.2, 20), skin, 0, 0.74, 0));
  for (const x of [-0.07, 0.07]) {
    torso.add(mesh(sph(0.028, 8), M('#1d1d1d'), x, 0.77, 0.18));
    torso.add(mesh(sph(0.032, 8), M('#f49a9a'), x * 1.7, 0.7, 0.15));
  }
  if (hat === 'chef') {
    torso.add(mesh(cyl(0.152, 0.152, 0.05, 16), M(band), 0, 0.88, 0));
    torso.add(mesh(cyl(0.15, 0.14, 0.14, 16), M('#ffffff'), 0, 0.95, 0));
    const puff = mesh(sph(0.19, 16), M('#ffffff'), 0, 1.07, 0); puff.scale.set(1, 0.72, 1); torso.add(puff);
  } else if (hat === 'cap') {
    const c = mesh(sph(0.2, 16), M(band), 0, 0.82, 0); c.scale.set(1.03, 0.55, 1.03); torso.add(c);
    torso.add(mesh(box(0.22, 0.03, 0.14), M(band), 0, 0.82, 0.2));
  } else if (hat === 'bowler') {
    torso.add(mesh(cyl(0.27, 0.27, 0.03, 18), M('#1b1b1b'), 0, 0.87, 0));
    torso.add(mesh(cyl(0.15, 0.17, 0.18, 16), M('#1b1b1b'), 0, 0.97, 0));
    torso.add(mesh(cyl(0.172, 0.172, 0.04, 16), M('#c0392b'), 0, 0.9, 0));
  } else if (hat === 'hair' || hat === 'crown') {
    const h = mesh(sph(0.205, 16), M(band), 0, 0.79, -0.02); h.scale.set(1.02, 0.7, 1.02); torso.add(h);
    if (hat === 'crown') {
      const gold = M('#f5c518', { metalness: 0.7, roughness: 0.3 });
      torso.add(mesh(cyl(0.13, 0.13, 0.07, 12), gold, 0, 0.96, 0));
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        torso.add(mesh(G('crn', () => new THREE.ConeGeometry(0.035, 0.08, 5)), gold, Math.sin(a) * 0.11, 1.03, Math.cos(a) * 0.11));
      }
    }
  }
  const handL = mesh(sph(0.075, 10), skin), handR = mesh(sph(0.075, 10), skin);
  torso.add(handL, handR);
  const hold = new THREE.Group(); hold.position.set(0, 0.4, 0.32); torso.add(hold);
  g.scale.setScalar(scale);
  scene.add(g);
  return { g, body: torso, legL, legR, handL, handR, hold };
}

const chars = new Map();
function makeChar(p) {
  const R = cfg.roles[p.r] || { color: '#999', emoji: '👤' };
  const h = makeHuman({ body: R.color });
  return { ...h, id: p.id, holdKey: '', holdVis: null, role: R, name: p.n,
    dx: p.x, dy: p.y, da: p.a, tx: p.x, ty: p.y, ta: p.a, px: p.x, py: p.y, spd: 0, p, shout: null };
}
function setHeld(c, h) {
  const key = itemKey(h);
  if (key === c.holdKey) return;
  c.holdKey = key;
  if (c.holdVis) { c.hold.remove(c.holdVis); animated.delete(c.holdVis); }
  c.holdVis = h ? itemVisual(h) : null;
  if (c.holdVis) { c.hold.add(c.holdVis); if (c.holdVis.userData.tick) animated.add(c.holdVis); }
}

const npcs = new Map(), walkers = new Map(), custVis = new Map(), ratVis = new Map(), dirtVis = new Map();
let catVis = null, inspVis = null, dirtSet = new Set();
function makeNpc(k) {
  const spot = NPC_SPOTS[k];
  const h = makeHuman({ body: '#8a96a3', band: { wash: '#3b82f6', chop: '#e5484d', prep: '#f59e0b' }[k], hat: 'cap', scale: 1.05 });
  const c = { ...h, id: 'npc' + k, name: spot.name, icon: cfg.shop[k].icon, dx: spot.x, dy: spot.y, da: spot.a, px: spot.x, py: spot.y, spd: 0, p: { w: 0 } };
  c.g.position.set(spot.x, 0, spot.y);
  c.g.rotation.y = spot.a;
  return c;
}
function makeWalker(k, w) {
  const h = makeHuman(k === 'waiter' ? { body: '#1f1f2e', band: '#1f1f2e', hat: 'hair', apron: '#ffffff', scale: 1.08 } : { body: '#7a1f5c', band: '#3d2b1f', hat: 'hair', apron: null, scale: 1.08 });
  if (k === 'host') { h.hold.add(mesh(box(0.16, 0.02, 0.2), M('#ffffff'), 0, 0.05, 0)); h.hold.add(mesh(cyl(0.01, 0.01, 0.18, 5), M('#e5484d'), 0.1, 0.07, 0)); }
  return { ...h, id: 'wk' + k, kind: k, name: cfg.shop[k].name, icon: cfg.shop[k].icon, dx: w.x, dy: w.y, da: w.a, tx: w.x, ty: w.y, ta: w.a, px: w.x, py: w.y, spd: 0, p: { h: k === 'host' ? 1 : 0 }, holdKey: '', holdVis: null };
}
function makeCustomer(cu) {
  const look = cu.k === 'ship' ? { body: '#16a34a', band: '#14532d', hat: 'cap' }
    : cu.k === 'tam' ? { body: '#9b4dca', band: '#d9d9d9', hat: 'hair' }
    : { body: SHIRTS[cu.c % 8], band: HAIRS[cu.c % 8], hat: cu.k === 'vip' ? 'crown' : 'hair' };
  const h = makeHuman({ ...look, apron: null, scale: 1.08 });
  if (cu.k === 'ship') h.hold.add(mesh(box(0.3, 0.22, 0.24), M('#c8a165'), 0, 0.06, 0));   // thùng giao hàng
  const pitch = cu.k === 'tam' ? 1.35 : 0.85 + ((cu.id * 37) % 60) / 100;
  return { ...h, id: 'cu' + cu.id, cid: cu.id, kind: cu.k, dx: cu.x, dy: cu.y, da: cu.a, tx: cu.x, ty: cu.y, ta: cu.a, px: cu.x, py: cu.y, spd: 0, sit: false, p: { w: 0, h: cu.k === 'ship' ? 1 : 0 }, say: null, pitch };
}
function makeRat() {
  const g = new THREE.Group(), fur = M('#7d838c');
  const b = mesh(sph(0.12, 12), fur, 0, 0.1, 0); b.scale.set(0.9, 0.75, 1.5); g.add(b);
  g.add(mesh(sph(0.085, 10), fur, 0, 0.12, 0.17));
  for (const x of [-0.055, 0.055]) {
    g.add(mesh(sph(0.04, 8), M('#f2a5b5'), x, 0.2, 0.14));
    g.add(mesh(sph(0.015, 6), M('#111'), x * 0.7, 0.15, 0.24));
  }
  g.add(mesh(sph(0.02, 6), M('#f27c96'), 0, 0.11, 0.26));
  const tail = mesh(cyl(0.012, 0.006, 0.32, 5), M('#f2a5b5'), 0, 0.07, -0.3); tail.rotation.x = Math.PI / 2 - 0.3; g.add(tail);
  g.scale.setScalar(1.35);
  scene.add(g);
  return { g, tail, dx: 0, dy: 0, da: 0, tx: 0, ty: 0, ta: 0 };
}
function makeCat(x, y) {
  const g = new THREE.Group(), fur = M('#f0932b');
  const b = mesh(sph(0.15, 12), fur, 0, 0.16, 0); b.scale.set(0.9, 0.8, 1.5); g.add(b);
  g.add(mesh(sph(0.12, 12), fur, 0, 0.27, 0.2));
  for (const ex of [-0.06, 0.06]) {
    g.add(mesh(G('ear', () => new THREE.ConeGeometry(0.04, 0.08, 6)), fur, ex, 0.39, 0.2));
    g.add(mesh(sph(0.018, 6), M('#111'), ex, 0.3, 0.31));
  }
  for (const [lx, lz] of [[-0.08, 0.12], [0.08, 0.12], [-0.08, -0.12], [0.08, -0.12]]) g.add(mesh(cyl(0.03, 0.03, 0.1, 6), M('#fff'), lx, 0.05, lz));
  const tail = mesh(cyl(0.025, 0.02, 0.3, 6), fur, 0, 0.3, -0.25); tail.rotation.x = -0.6; g.add(tail);
  g.scale.setScalar(1.3);
  scene.add(g);
  return { g, tail, dx: x, dy: y, da: 0, tx: x, ty: y, ta: 0 };
}
const splatTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(92,58,30,.75)';
  for (const [x, y, r] of [[64, 64, 34], [38, 50, 16], [92, 78, 18], [70, 30, 12], [40, 88, 11], [96, 44, 9]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  g.font = '44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('💩', 64, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
})();

function syncWorldExtras(m) {
  // nhân viên đứng một chỗ
  for (const k of Object.keys(NPC_SPOTS)) {
    const on = m.staff?.[k] > 0;
    let n = npcs.get(k);
    if (on && !n) { n = makeNpc(k); npcs.set(k, n); }
    if (!on && n) { scene.remove(n.g); npcs.delete(k); }
    if (n) n.p.w = m.staff[k] === 2 ? 1 : 0;
  }
  // nhân viên đi lại: bồi bàn, tiếp khách
  for (const k of ['waiter', 'host']) {
    const w = m.wk?.[k];
    let v = walkers.get(k);
    if (w && !v) { v = makeWalker(k, w); walkers.set(k, v); }
    if (!w && v) { scene.remove(v.g); walkers.delete(k); }
    if (v && w) {
      v.tx = w.x; v.ty = w.y; v.ta = w.a;
      if (k === 'waiter') { v.p.h = w.h ? 1 : 0; setHeld(v, w.h || null); }
    }
  }
  // khách
  const seenC = new Set();
  for (const cu of m.cu || []) {
    seenC.add(cu.id);
    let v = custVis.get(cu.id);
    if (!v) { v = makeCustomer(cu); custVis.set(cu.id, v); }
    v.tx = cu.x; v.ty = cu.y; v.ta = cu.a; v.mood = cu.m;
    if (cu.s && !v.sit) { v.dx = cu.x; v.dy = cu.y; v.da = cu.a; }
    v.sit = !!cu.s;
  }
  for (const [id, v] of custVis) if (!seenC.has(id)) { scene.remove(v.g); custVis.delete(id); }
  // chuột
  const seen = new Set();
  for (const r of m.rats || []) {
    seen.add(r.id);
    let v = ratVis.get(r.id);
    if (!v) { v = makeRat(); v.dx = r.x; v.dy = r.y; v.da = r.a; ratVis.set(r.id, v); SFX.squeak(); }
    v.tx = r.x; v.ty = r.y; v.ta = r.a;
  }
  for (const [id, v] of ratVis) if (!seen.has(id)) { scene.remove(v.g); ratVis.delete(id); }
  // mèo
  if (m.cat && !catVis) catVis = makeCat(m.cat.x, m.cat.y);
  if (!m.cat && catVis) { scene.remove(catVis.g); catVis = null; }
  if (catVis) { catVis.tx = m.cat.x; catVis.ty = m.cat.y; catVis.ta = m.cat.a; }
  // thanh tra
  if (m.insp && !inspVis) {
    const h = makeHuman({ body: '#2d3a4a', hat: 'bowler', apron: '#f4f4f4' });
    h.hold.add(mesh(box(0.22, 0.02, 0.28), M('#8b5a2b'), 0, 0.05, 0));
    h.hold.add(mesh(box(0.18, 0.022, 0.22), M('#ffffff'), 0, 0.06, 0));
    inspVis = { ...h, dx: m.insp.x, dy: m.insp.y, da: 0, tx: m.insp.x, ty: m.insp.y, ta: 0, px: m.insp.x, py: m.insp.y, spd: 0, id: 'insp', p: { h: 1 } };
  }
  if (!m.insp && inspVis) { scene.remove(inspVis.g); inspVis = null; }
  if (inspVis) { inspVis.tx = m.insp.x; inspVis.ty = m.insp.y; inspVis.ta = m.insp.a; inspVis.left = m.insp.left; }
  // vết bẩn
  const ds = new Set(m.dirt || []);
  for (const i of ds) {
    if (dirtVis.has(i)) continue;
    const d = new THREE.Mesh(planeG(0.7), splatTex);
    d.rotation.x = -Math.PI / 2; d.rotation.z = Math.random() * 6;
    d.position.set((i % MW) + 0.5, 0.012, ((i / MW) | 0) + 0.5);
    world.add(d); dirtVis.set(i, d);
  }
  for (const [i, d] of dirtVis) if (!ds.has(i)) { world.remove(d); dirtVis.delete(i); }
  dirtSet = ds;
}
function clearPlayers() {
  for (const c of chars.values()) { scene.remove(c.g); if (c.holdVis) animated.delete(c.holdVis); }
  chars.clear();
  for (const coll of [npcs, walkers, custVis, ratVis]) { for (const v of coll.values()) scene.remove(v.g); coll.clear(); }
  for (const d of dirtVis.values()) world?.remove(d);
  dirtVis.clear(); dirtSet = new Set();
  if (catVis) { scene.remove(catVis.g); catVis = null; }
  if (inspVis) { scene.remove(inspVis.g); inspVis = null; }
}

/* ======================= snapshots ======================= */
const orderEls = new Map();
function onSnap(m) {
  snap = m;
  if (!world) return;
  for (const s of tileState) { s.item = null; s.n = 0; s.prog = 0; s.fire = 0; s.ext = 0; }
  for (const [i, item, n, prog, fire, ext] of m.tl) { const s = tileState[i]; s.item = item; s.n = n; s.prog = prog; s.fire = fire; s.ext = ext; }
  tableByTile.clear();
  for (const tb of m.tb || []) tableByTile.set(tb.i, tb);
  for (let i = 0; i < tiles.length; i++) if (tiles[i]) updateTileVisual(i);

  const seen = new Set();
  for (const p of m.pl) {
    seen.add(p.id);
    let c = chars.get(p.id);
    if (!c) { c = makeChar(p); chars.set(p.id, c); }
    c.p = p; c.tx = p.x; c.ty = p.y; c.ta = p.a;
    setHeld(c, p.h);
    if (p.id === myId && !me.inited) { me.x = p.x; me.y = p.y; me.a = p.a; me.inited = true; camC.set(p.x, 0, p.y); }
  }
  for (const [id, c] of chars) if (!seen.has(id)) { scene.remove(c.g); chars.delete(id); }
  syncWorldExtras(m);

  // HUD
  const sec = Math.ceil(m.time);
  $('#timer').textContent = fmtTime(sec);
  $('#timer').classList.toggle('low', sec <= 30);
  if (phase === 'playing' && sec <= 10 && sec < lastSec && m.cd <= 0) SFX.tick();
  lastSec = sec;
  if (m.money !== lastMoney) {
    const s = $('#money'); s.textContent = `💰 ${m.money}`;
    s.classList.remove('bump', 'minus'); void s.offsetWidth; s.classList.add(m.money > lastMoney ? 'bump' : 'minus');
    lastMoney = m.money;
  }
  const rb = $('#rep .rbar i');
  rb.style.width = m.rep + '%';
  rb.style.background = m.rep > 60 ? '#35c759' : m.rep > 30 ? '#ffc93c' : '#ef4444';
  $('#rep').classList.toggle('low', m.rep <= 30);
  $('#btnShop').classList.toggle('can', !shopOpened && m.money >= 60);
  renderChips(m);
  if (shopOpen()) renderShop();
  renderOrders(m.orders);

  // đếm ngược
  const cdEl = $('#cd');
  if (m.cd > 0) {
    const n = Math.ceil(m.cd);
    if (n !== lastCd) { cdEl.className = ''; cdEl.innerHTML = `<span>${n}</span>`; SFX.tick(); lastCd = n; }
  } else if (lastCd > 0) {
    lastCd = 0;
    cdEl.className = 'go'; cdEl.innerHTML = '<span>MỞ CỬA! 🔥</span>'; SFX.go();
    setTimeout(() => cdEl.classList.add('hidden'), 900);
  }
}

let chipsKey = '';
function renderChips(m) {
  const c = [];
  if (m.mode === 'daily') { const d = cfg.daily[m.mod]; c.push(`<span class="chip">🎯 ${d ? d.icon + ' ' + d.name : 'Thử thách'}</span>`); }
  else {
    c.push(`<span class="chip">📅 Ngày ${m.day}</span>`);
    c.push(`<span class="chip ${m.earned >= m.target ? 'good' : ''}">🎯 ${m.earned}/${m.target}</span>`);
  }
  if (m.time <= 40 && m.time > 0) c.push('<span class="chip">🌙 Sắp đóng cửa</span>');
  const hands = (m.tb || []).filter(t => t.st === 'order').length;
  if (hands) c.push(`<span class="chip bad">🙋 ×${hands}</span>`);
  if (m.q?.length) c.push(`<span class="chip">⏳ Hàng chờ ×${m.q.length}</span>`);
  const dirtyT = (m.tb || []).filter(t => t.st === 'dirty').length;
  if (dirtyT) c.push(`<span class="chip">🍽️ Bàn bẩn ×${dirtyT}</span>`);
  if (m.rush > 0) c.push(`<span class="chip">🔥 Cao điểm ${Math.ceil(m.rush)}s</span>`);
  if (m.out > 0) c.push(`<span class="chip bad">🔌 ${Math.ceil(m.out)}s</span>`);
  if (m.insp) c.push(`<span class="chip bad">🕵️ ${Math.ceil(m.insp.left)}s</span>`);
  if (m.rats?.length) c.push(`<span class="chip bad">🐀 ×${m.rats.length}</span>`);
  const fires = m.tl.filter(t => t[4]).length;
  if (fires) c.push(`<span class="chip bad">🔥 Cháy ×${fires}</span>`);
  if (m.dirt?.length >= 3) c.push(`<span class="chip bad">💩 ×${m.dirt.length}</span>`);
  if (m.heat > 0) c.push(`<span class="chip bad">🥵 ${Math.ceil(m.heat)}s</span>`);
  if (m.stock) c.push(`<span class="chip bad">📦 Hết ${EMO[m.stock.ing]} ${Math.ceil(m.stock.left)}s</span>`);
  if (m.ship?.length) c.push(`<span class="chip bad">🛵 Shipper chờ ×${m.ship.length}</span>`);
  if (m.block > 0) c.push(`<span class="chip good">🧪 ${Math.ceil(m.block)}s</span>`);
  if (m.up?.license) c.push('<span class="chip good">📋</span>');
  const html = c.join('');
  if (html !== chipsKey) { chipsKey = html; $('#evchips').innerHTML = html; }
}

let pendingLeave = null;
const MAX_CARDS = 6;
function renderOrders(orders) {
  const boxEl = $('#orders');
  const seen = new Set();
  orders.slice(0, MAX_CARDS).forEach((o, idx) => {
    seen.add(o.id);
    let el = orderEls.get(o.id);
    if (!el) {
      const R = cfg.recipes[o.r];
      el = document.createElement('div');
      el.className = 'order enter' + (o.k ? ' ' + o.k : '');
      el.innerHTML = `<span class="tb">${o.t ? `Bàn ${o.t}` : '🛵 Mang đi'}</span><div class="oi">${R.icon}</div><div class="op">${R.parts.map(p => PART_HTML[p]).join('')}</div><div class="ob"><i></i></div>`;
      el._bar = el.querySelector('.ob i');
      boxEl.appendChild(el);
      orderEls.set(o.id, el);
      setTimeout(() => el.classList.remove('enter'), 460);
    }
    const f = o.left / o.max;
    el._bar.style.width = (f * 100).toFixed(1) + '%';
    el._bar.style.background = f > 0.5 ? '#35c759' : f > 0.25 ? '#ffc93c' : '#ef4444';
    el.classList.toggle('urgent', f < 0.2);
    el.style.order = idx;
  });
  for (const [id, el] of orderEls) {
    if (seen.has(id)) continue;
    orderEls.delete(id);
    el.classList.remove('urgent');
    const stillThere = orders.some(o => o.id === id);
    if (stillThere) { el.remove(); continue; }
    el.classList.add(pendingLeave === 'fail' ? 'gone' : 'done');
    setTimeout(() => el.remove(), 380);
  }
  let more = boxEl.querySelector('.more');
  const extra = orders.length - MAX_CARDS;
  if (extra > 0) {
    if (!more) { more = document.createElement('div'); more.className = 'more'; boxEl.appendChild(more); }
    more.textContent = `+${extra}`; more.style.order = 99;
  } else more?.remove();
  pendingLeave = null;
}

/* ======================= events ======================= */
const tileWorld = i => [(i % MW) + 0.5, 1.1, ((i / MW) | 0) + 0.5];
const tableWorld = num => { const tb = snap?.tb?.find(t => t.num === num); return tb ? tileWorld(tb.i) : null; };
function popup(pos, text, bad) {
  if (!pos) return;
  _v.set(pos[0], pos[1], pos[2]).project(camera);
  const el = document.createElement('div');
  el.className = 'pop' + (bad ? ' bad' : '');
  el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * VW}px,${(-_v.y * 0.5 + 0.5) * VH}px)`;
  el.innerHTML = `<b>${text}</b>`;
  ovRoot.appendChild(el);
  setTimeout(() => el.remove(), 1250);
}
function onEvent(m) {
  switch (m.e) {
    case 'pick': SFX.pick(); vibrate(10); break;
    case 'drop': SFX.drop(); vibrate(10); break;
    case 'trash': SFX.trash(); break;
    case 'hint': toast(m.msg); SFX.wrong(); break;
    case 'wrong': toast(m.msg, 'bad'); SFX.wrong(); vibrate([30, 40, 30]); break;
    case 'chopped': case 'washed': SFX.done(); break;
    case 'cooked': SFX.cooked(); break;
    case 'burnt': SFX.burnt(); toast('⚫ KHÉT NỒI RỒI!!!', 'bad'); break;
    case 'enter': SFX.door(); if (m.vip) toast('👑 Khách VIP vừa vào!', 'good'); break;
    case 'day': {
      const news = (m.news || []).map(k => `${cfg.events[k].icon} ${cfg.events[k].name}`).join(' · ');
      if (m.mode === 'daily') { const d = cfg.daily[m.mod]; banner(`🎯 ${d.icon} ${d.name.toUpperCase()}`, `${d.desc}<br>Thử thách hôm nay · ${fmtTime(m.left)}`, '', 4200); }
      else if (m.resumed) banner(`📂 NGÀY ${m.day} (CHƠI TIẾP)`, `Còn ${fmtTime(m.left)} · Chỉ tiêu 🎯 ${m.target}💰`, '', 3500);
      else banner(`☀️ NGÀY ${m.day}`, `Chỉ tiêu 🎯 ${m.target}💰 · tối đa ${m.cap} khách cùng lúc${news ? `<br>Mới: ${news}` : ''}`, '', news ? 5000 : 3500);
      SFX.level();
      break;
    }
    case 'stun':
      me.stun = m.dur;
      me.vx = me.vy = 0;
      toast('🗣️ Bị bà Tám níu lại tám chuyện!', 'bad');
      vibrate([40, 30, 40]);
      break;
    case 'restock': toast(`📦 Có ${EMO[m.ing]} ${ING_NAME[m.ing]} lại rồi!`, 'good'); SFX.done(); break;
    case 'cool': toast('🌤️ Hết nắng nóng rồi!', 'good'); break;
    case 'hand': SFX.hand(); toast(`🙋 Bàn ${m.tn} muốn gọi món!`); break;
    case 'order': {
      SFX.order();
      const c = chars.get(m.id);
      toast(m.id ? `📝 ${c ? c.name : ''} ghi món bàn ${m.tn}` : `📝 ${m.by === 'waiter' ? '🤵 Bồi bàn' : 'NV tiếp khách'} ghi món bàn ${m.tn}`);
      break;
    }
    case 'charm':
      SFX.done();
      popup(tableWorld(m.tn), `😊 +${m.pct}% kiên nhẫn`);
      toast(`😊 ${m.by === 'waiter' ? 'Bồi bàn' : 'NV tiếp khách'} nói chuyện khéo, bàn ${m.tn} chịu chờ thêm!`, 'good');
      break;
    case 'pickup': popup(tileWorld(m.i), '🤵'); break;
    case 'deliver': pendingLeave = 'serve'; SFX.drop(); popup(tableWorld(m.tn), m.id ? '🍽️' : '🤵🍽️'); if (m.id === myId) vibrate(25); break;
    case 'pay':
      SFX.serve(); setTimeout(SFX.cash, 250);
      if (m.ship) {
        pendingLeave = 'serve';
        toast(`🛵 Giao đơn mang đi +${m.pts}💰`, 'good');
        const v = [...custVis.values()].find(c => c.kind === 'ship');
        if (v) popup([v.dx, 1.4, v.dy], `+${m.pts}💰`);
      } else {
        toast(`💵 Bàn ${m.tn} trả ${m.pts}💰${m.vip ? ' 👑' : m.kind === 'bday' ? ' 🎂' : ''}`, 'good');
        popup(tableWorld(m.tn), `+${m.pts}💰`);
      }
      break;
    case 'angry':
      pendingLeave = 'fail';
      SFX.fail();
      toast(m.kind === 'ship' ? '😡 Shipper chờ lâu quá bỏ đi! −10❤️' : m.tn ? `😡 Bàn ${m.tn} bỏ về! −${m.vip ? 15 : 10}❤️` : `😡 Khách xếp hàng bỏ về! −${m.vip ? 15 : 10}❤️`, 'bad');
      vibrate([60, 40, 60]);
      break;
    case 'say': onSay(m); break;
    case 'event': onGameEvent(m); break;
    case 'fire': SFX.burnt(); break;
    case 'extinguish': SFX.spray(); popup(tileWorld(m.i), '💨'); break;
    case 'whack': SFX.whack(); popup([m.x, 0.6, m.y], '💥'); vibrate(20); break;
    case 'ratDie':
      SFX.whack(); setTimeout(SFX.squeak, 80);
      popup([m.x, 0.6, m.y], m.cat ? '🐱💥' : m.poison ? '☠️' : m.id === myId ? `💥 +${m.n || 3}💰` : '💥');
      if (m.id === myId) vibrate(30);
      break;
    case 'ratEat': SFX.squeak(); popup(tileWorld(m.i), 'Ăn vụng! 🐀', true); break;
    case 'clean': SFX.clean(); break;
    case 'power': toast('💡 Có điện lại rồi!', 'good'); SFX.powerUp(); break;
    case 'wage':
      if (m.total) toast(`💸 Trả lương nhân viên: −${m.total}💰`);
      if (m.quit.length) { banner('😤 NHÂN VIÊN NGHỈ VIỆC!', `Không đủ tiền trả lương: ${m.quit.map(k => cfg.shop[k].icon + ' ' + cfg.shop[k].name).join(', ')}`, 'bad'); SFX.fail(); }
      break;
    case 'buy': {
      const c = chars.get(m.id), it = cfg.shop[m.k];
      SFX.cash();
      toast(`${c ? c.name : 'Ai đó'} mua ${it.icon} ${it.name}`, 'good');
      break;
    }
    case 'inspResult':
      if (m.pass) { banner('✅ THANH TRA ĐẠT!', m.license ? 'Có giấy chứng nhận ATTP 📋 · +60💰 +10❤️' : 'Sạch bong! +60💰 +10❤️', 'good', 3000); SFX.level(); }
      else { banner('❌ THANH TRA PHẠT!', `${m.v.join(' · ')}<br>−${m.fine}💰 −${m.v.length * 8}❤️`, 'bad', 4200); SFX.fail(); }
      break;
    case 'shout': {
      const c = chars.get(m.id);
      if (c) { c.shout = { text: SHOUTS[m.i] || '!', until: performance.now() + 2200 }; SFX.shout(); }
      break;
    }
  }
}

function onSay(m) {
  const v = custVis.get(m.cid);
  let text = pickOf(PHRASES[m.k] || PHRASES.grumble, m.i);
  if (m.k === 'order' && m.r) text = text.replace('{d}', cfg.recipes[m.r].name);
  const mood = { grumble: 1, angry: 2, leave: 2, wrong: 1, happy: 3, order: 0 }[m.k] ?? 0;
  if (v) v.say = { text, mood, until: performance.now() + 2800 };
  // chỉ đọc to khi khách ở gần mình (hoặc lúc bỏ về) để khỏi ồn
  const near = !v || Math.hypot(v.dx - me.x, v.dy - me.y) < 10 || camMode === 'overview';
  if (near || m.k === 'leave') speak(text, v ? v.pitch : 1, mood, m.k === 'leave' || m.k === 'angry' || m.k === 'tam');
}

function onGameEvent(m) {
  const k = m.k;
  if (m.blocked) {
    const msg = { rats: 'Thuốc chuột chặn được đàn chuột 🧪', fire: 'Vòi phun nước dập lửa kịp 🚿', outage: 'Cúp điện nhưng có máy phát 🔋' }[k];
    if (msg) toast(msg, 'good');
    return;
  }
  switch (k) {
    case 'rats':
      banner(m.first ? '🐀 CÓ CHUỘT!' : `🐀 ${m.n} CON CHUỘT!`, m.first ? 'Tay không, đứng gần rồi bấm 🔨 Đập nó!' : 'Đập chuột hoặc mua 🐱 mèo / 🧪 thuốc trong 🛒');
      SFX.squeak(); setTimeout(SFX.squeak, 200);
      break;
    case 'rush': banner('🔥 GIỜ CAO ĐIỂM!', 'Khách kéo tới gấp đôi, tiền x1.5 trong 40s'); SFX.level(); break;
    case 'vip': banner('👑 KHÁCH VIP!', 'Trả tiền x3 nhưng nóng tính lắm, ưu tiên phục vụ trước!'); break;
    case 'fire': banner('🧯 CHÁY LÒ!!!', 'Mua bình cứu hỏa 🛒, cầm rồi bấm 🧯 Xịt. Lửa sẽ lan!', 'bad', 3200); SFX.alarm(); vibrate([80, 60, 80]); break;
    case 'outage': banner('🔌 CÚP ĐIỆN!', `Bếp tắt ${Math.round(m.dur)}s · mua 🔋 máy phát để khỏi lo`, 'bad'); SFX.powerDown(); break;
    case 'insp': banner('🕵️ THANH TRA TỚI!', '35s để dọn: chuột, lửa, sàn bẩn 💩, bàn bẩn, đĩa bẩn', 'bad', 3200); SFX.whistle(); break;
    case 'bday': banner('🎂 TIỆC SINH NHẬT!', 'Bàn 2 người, trả tiền gấp đôi. Hát lên nào 🎉', 'good'); SFX.level(); break;
    case 'tam': banner('🗣️ BÀ TÁM TỚI QUÁN!', 'Đi ngang bàn bà là bị níu lại tám chuyện. Né ra!', 'bad', 3200); SFX.door(); break;
    case 'ship': banner('🛵 SHIPPER TỚI!', `Đơn mang đi: ${cfg.recipes[m.r].icon} ${cfg.recipes[m.r].name}. Cầm món ra cửa, đứng gần bấm 🛵 Giao`); SFX.hand(); break;
    case 'heat': banner('🥵 NẮNG NÓNG!', `Khách mất kiên nhẫn nhanh hơn trong ${m.dur}s · 🧊 mời trà đá trong 🛒`, 'bad'); SFX.alarm(); break;
    case 'stock': banner(`📦 HẾT ${ING_NAME[m.ing].toUpperCase()}!`, `Thùng ${EMO[m.ing]} trống trơn ${m.dur}s · 📞 gọi giao gấp trong 🛒`, 'bad'); SFX.fail(); break;
  }
}

/* ======================= camera ======================= */
let VW = innerWidth, VH = innerHeight;
let camMode = 'overview';
const camTarget = new THREE.Vector3(), camC = new THREE.Vector3();
const ELEV = THREE.MathUtils.degToRad(62);
const camDir = new THREE.Vector3(0, Math.sin(ELEV), Math.cos(ELEV));
const cam = { d: 20, offZ: 0, visW: 30, visH: 9 };
const FOLLOW_BOX = { w: 13, h: 8.4 };
function placeCam(d) { camera.position.copy(camTarget).addScaledVector(camDir, d); camera.lookAt(camTarget); camera.updateMatrixWorld(); }
function camBounds(x0, x1, z0, z1) {
  let minX = 9, maxX = -9, minY = 9, maxY = -9;
  for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [0, 1]) {
    _v.set(x, y, z).project(camera);
    minX = Math.min(minX, _v.x); maxX = Math.max(maxX, _v.x); minY = Math.min(minY, _v.y); maxY = Math.max(maxY, _v.y);
  }
  return { minX, maxX, minY, maxY };
}
// tìm khoảng cách camera để khung (cx±bw/2, cz±bh/2) vừa màn hình (chừa chỗ HUD)
function fitBox(cx, cz, bw, bh) {
  const hudH = phase === 'playing' || phase === 'ended' ? $('#hud').offsetHeight || 62 : 0;
  const top = 1 - (2 * hudH) / VH - 0.01, bot = -0.985, xm = phase === 'playing' ? 0.92 : 0.97;
  const x0 = cx - bw / 2, x1 = cx + bw / 2, z0 = cz - bh / 2, z1 = cz + bh / 2;
  camTarget.set(cx, 0, cz);
  let d = 20;
  for (let pass = 0; pass < 4; pass++) {
    let lo = 2, hi = 160;
    for (let k = 0; k < 26; k++) {
      d = (lo + hi) / 2; placeCam(d);
      const b = camBounds(x0, x1, z0, z1);
      if (b.maxX - b.minX <= 2 * xm && b.maxY - b.minY <= top - bot) hi = d; else lo = d;
    }
    d = hi; placeCam(d);
    const b = camBounds(x0, x1, z0, z1);
    camTarget.z -= ((b.maxY + b.minY) / 2 - (top + bot) / 2) * d * 0.4;
  }
  placeCam(d);
  const b = camBounds(x0, x1, z0, z1);
  cam.d = d; cam.offZ = camTarget.z - cz;
  cam.visW = bw * (2 * xm) / (b.maxX - b.minX);
  cam.visH = bh * (top - bot) / (b.maxY - b.minY);
}
function fitCamera() {
  if (!world) return;
  if (camMode === 'follow' && phase === 'playing') fitBox(MW / 2, MH / 2, FOLLOW_BOX.w, FOLLOW_BOX.h);
  else { fitBox(MW / 2, MH / 2 - 0.15, MW + 0.6, MH + 0.3); camC.set(MW / 2, 0, MH / 2 - 0.15); }
  updateCam(1);
}
function updateCam(k) {
  if (camMode === 'follow' && phase === 'playing' && me.inited) {
    const hw = cam.visW / 2, hh = cam.visH / 2;
    const tx = cam.visW >= MW + 0.8 ? MW / 2 : clamp(me.x, hw - 0.4, MW - hw + 0.4);
    const tz = cam.visH >= MH + 0.6 ? MH / 2 : clamp(me.y, hh - 0.6, MH - hh + 0.2);
    camC.x += (tx - camC.x) * k; camC.z += (tz - camC.z) * k;
  }
  camTarget.set(camC.x, 0, camC.z + cam.offZ);
  placeCam(cam.d);
  sun.position.set(camC.x + 4, 14, camC.z + 7);
  sun.target.position.set(camC.x, 0, camC.z);
}
function resize() {
  VW = innerWidth; VH = innerHeight;
  renderer.setSize(VW, VH, false);
  camera.aspect = VW / VH;
  camera.updateProjectionMatrix();
  fitCamera();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 250));
$('#btnMap').onclick = () => {
  camMode = camMode === 'follow' ? 'overview' : 'follow';
  $('#btnMap').classList.toggle('on', camMode === 'overview');
  fitCamera();
};

/* ======================= input ======================= */
const keys = new Set();
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const joyZone = $('#joyZone'), joyBase = $('#joyBase'), joyKnob = $('#joyKnob');
const JOY_R = 52;
joyZone.addEventListener('pointerdown', e => {
  if (joy.id !== null) return;
  e.preventDefault();
  joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
  joyZone.setPointerCapture(e.pointerId);
  joyBase.style.left = joy.ox + 'px'; joyBase.style.top = (joy.oy - joyZone.getBoundingClientRect().top) + 'px';
  joyBase.classList.add('active');
  joyKnob.style.transform = '';
  ac();
});
joyZone.addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  const d = Math.hypot(dx, dy);
  if (d > JOY_R * 1.6) { // kéo đế theo ngón tay
    const k = 1 - (JOY_R * 1.6) / d;
    joy.ox += dx * k; joy.oy += dy * k;
    joyBase.style.left = joy.ox + 'px'; joyBase.style.top = (joy.oy - joyZone.getBoundingClientRect().top) + 'px';
    dx = e.clientX - joy.ox; dy = e.clientY - joy.oy;
  }
  const dd = Math.hypot(dx, dy), f = dd > JOY_R ? JOY_R / dd : 1;
  joy.x = (dx * f) / JOY_R; joy.y = (dy * f) / JOY_R;
  joyKnob.style.transform = `translate(${dx * f}px,${dy * f}px)`;
});
const joyEnd = e => {
  if (e.pointerId !== joy.id) return;
  joy.id = null; joy.x = joy.y = 0;
  joyBase.classList.remove('active');
  joyBase.style.left = ''; joyBase.style.top = '';
  joyKnob.style.transform = '';
};
joyZone.addEventListener('pointerup', joyEnd);
joyZone.addEventListener('pointercancel', joyEnd);

function bindBtn(sel, fn) {
  const b = $(sel);
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('down'); ac(); fn(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => b.classList.remove('down'));
}
bindBtn('#btnAct', () => doAct());
bindBtn('#btnWork', () => doWork());
bindBtn('#btnDash', () => doDash());
bindBtn('#btnShout', () => $('#shoutMenu').classList.toggle('hidden'));
$('#shoutMenu').innerHTML = SHOUTS.map((s, i) => `<button data-i="${i}">${s}</button>`).join('');
$('#shoutMenu').addEventListener('pointerdown', e => {
  const b = e.target.closest('button'); if (!b) return;
  e.preventDefault();
  send({ t: 'shout', i: +b.dataset.i });
  $('#shoutMenu').classList.add('hidden');
});

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (e.repeat || phase !== 'playing') return;
  if (e.code === 'Space' || e.code === 'KeyJ') { doAct(); e.preventDefault(); }
  else if (e.code === 'KeyE' || e.code === 'KeyK') doWork();
  else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') doDash();
  else if (e.code === 'KeyM') $('#btnMap').click();
  else if (/^Digit[1-8]$/.test(e.code)) send({ t: 'shout', i: +e.code.slice(5) - 1 });
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

let target = -1, actAnim = 0, ratTarget = null, shipTarget = null;
function doAct() {
  if (phase !== 'playing' || (target < 0 && !ratTarget && !shipTarget)) return;
  send({ t: 'act', x: target >= 0 ? target % MW : -1, y: target >= 0 ? (target / MW) | 0 : -1 });
  actAnim = 0.15;
}
function doWork() {
  if (phase !== 'playing' || target < 0) return;
  send({ t: 'work', x: target % MW, y: (target / MW) | 0 });
}
function doDash() {
  if (phase !== 'playing' || me.dashCD > 0 || !me.inited || me.stun > 0) return;
  me.dashT = 0.15; me.dashCD = 0.8;
  SFX.dash(); vibrate(15);
}

/* ======================= movement ======================= */
function solidAt(i, j) { return i < 0 || j < 0 || i >= MW || j >= MH || solid[j][i]; }
function hits(x, y) {
  for (let j = Math.floor(y - RADIUS); j <= Math.floor(y + RADIUS); j++) {
    for (let i = Math.floor(x - RADIUS); i <= Math.floor(x + RADIUS); i++) {
      if (!solidAt(i, j)) continue;
      const nx = clamp(x, i, i + 1), ny = clamp(y, j, j + 1);
      if ((x - nx) ** 2 + (y - ny) ** 2 < RADIUS * RADIUS) return true;
    }
  }
  return false;
}
function moveBy(dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.08));
  const sx = dx / steps, sy = dy / steps;
  for (let s = 0; s < steps; s++) {
    if (!hits(me.x + sx, me.y)) me.x += sx;
    if (!hits(me.x, me.y + sy)) me.y += sy;
  }
}
const myState = () => snap?.pl.find(p => p.id === myId);

function updateMe(dt) {
  let ix = joy.x, iy = joy.y;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iy += 1;
  if (me.stun > 0) { me.stun -= dt; ix = iy = 0; }   // bị bà Tám níu lại
  let mag = Math.hypot(ix, iy);
  if (mag > 1) { ix /= mag; iy /= mag; mag = 1; }
  if (mag < 0.15) { ix = iy = 0; mag = 0; }
  const mine = myState();
  const onDirt = dirtSet.has(Math.floor(me.y) * MW + Math.floor(me.x)) && mine?.h?.k !== 'mop';
  const speed = BASE_SPEED * (mine?.r === 'serve' ? 1.2 : 1) * (snap?.up?.shoes ? 1.15 : 1) * (onDirt ? 0.6 : 1);
  if (mag > 0) me.a = Math.atan2(ix, iy);
  const k = Math.min(1, dt * 16);
  me.vx += (ix * speed - me.vx) * k;
  me.vy += (iy * speed - me.vy) * k;
  me.dashCD = Math.max(0, me.dashCD - dt);
  let vx = me.vx, vy = me.vy;
  if (me.dashT > 0) { me.dashT -= dt; vx = Math.sin(me.a) * 12; vy = Math.cos(me.a) * 12; }
  moveBy(vx * dt, vy * dt);
  // đẩy nhau
  for (const c of chars.values()) {
    if (c.id === myId) continue;
    const ox = me.x - c.dx, oy = me.y - c.dy, d = Math.hypot(ox, oy);
    if (d < 0.56 && d > 0.001) moveBy((ox / d) * (0.56 - d) * 0.5, (oy / d) * (0.56 - d) * 0.5);
  }
  $('#btnDash').classList.toggle('cool', me.dashCD > 0);
}

let lastSend = 0, lastSent = '';
function sendPos(now) {
  if (now - lastSend < 60) return;
  lastSend = now;
  const x = +me.x.toFixed(2), y = +me.y.toFixed(2), a = +me.a.toFixed(2);
  const s = `${x},${y},${a}`;
  if (s === lastSent) return;
  lastSent = s;
  send({ t: 'p', x, y, a });
}

// ghế thì quy về cái bàn bên cạnh
function tableOf(i) {
  if (i < 0) return -1;
  const info = tiles[i];
  if (!info) return -1;
  if (info.type === 'table') return i;
  if (info.type === 'chair') { if (map((i % MW) + 1, (i / MW) | 0) === 't') return i + 1; if (map((i % MW) - 1, (i / MW) | 0) === 't') return i - 1; }
  return -1;
}
function findTarget() {
  const dx = Math.sin(me.a), dy = Math.cos(me.a);
  let best = -1, bs = 1e9;
  const cx = Math.floor(me.x), cy = Math.floor(me.y);
  for (let j = cy - 2; j <= cy + 2; j++) for (let i = cx - 2; i <= cx + 2; i++) {
    if (i < 0 || j < 0 || i >= MW || j >= MH || !solid[j][i]) continue;
    const info = tiles[j * MW + i];
    if (!info) continue;
    const vx = i + 0.5 - me.x, vy = j + 0.5 - me.y, d = Math.hypot(vx, vy);
    if (d > 1.3) continue;
    const dot = (vx * dx + vy * dy) / d;
    if (dot < 0.3) continue;
    const s = d - dot * 0.8;
    if (s < bs) { bs = s; best = j * MW + i; }
  }
  return best;
}
// shipper đang chờ đơn ở gần mình (server tự nhận ra khi mình bấm ✋)
function findShipper() {
  for (const s of snap?.ship || []) {
    const v = custVis.get(s.c);
    if (v && Math.hypot(v.dx - me.x, v.dy - me.y) < 1.4) return v;
  }
  return null;
}
function findRat() {
  const fx = Math.sin(me.a), fy = Math.cos(me.a);
  let best = null, bd = 1.1;
  for (const v of ratVis.values()) {
    const dx = v.dx - me.x, dy = v.dy - me.y, d = Math.hypot(dx, dy);
    if (d < bd && (d < 0.35 || (dx * fx + dy * fy) / d > 0.2)) { bd = d; best = v; }
  }
  return best;
}

let btnState = '';
function updateButtons() {
  const h = myState()?.h;
  const info = target >= 0 ? tiles[target] : null;
  const s = target >= 0 ? tileState[target] : null;
  const ti = tableOf(target);
  const tb = ti >= 0 ? tableByTile.get(ti) : null;
  let ic = '✋', lb = 'Cầm';
  if (shipTarget) { ic = '🛵'; lb = 'Giao'; }
  else if (ratTarget) { ic = '🔨'; lb = 'Đập'; }
  else if (tb) {
    if (h?.k === 'plate' && h.c.length) { ic = '🍽️'; lb = 'Bưng'; }
    else if (tb.st === 'order') { ic = '📝'; lb = 'Ghi món'; }
    else if (tb.st === 'dirty' && (!h || h.k === 'dirty')) { ic = '🧹'; lb = 'Dọn'; }
    else { ic = '👀'; lb = 'Xem'; }
  } else if (h) {
    ic = '👐'; lb = 'Đặt';
    if (info?.type === 'trash') { ic = '🗑️'; lb = 'Vứt'; }
    else if (info?.type === 'stove' && h.k === 'plate') { ic = '🥄'; lb = 'Múc'; }
  } else if (info?.type === 'stove' && s?.item?.burnt) { ic = '🫗'; lb = 'Đổ'; }
  const isSink = info?.type === 'sink', isExt = h?.k === 'ext';
  const ready = isExt ? !!s?.fire : !h && !!info && !s.fire && ((info.type === 'board' && s.item?.k === 'ing' && s.item.s === 'raw') || (isSink && s.n > 0));
  const key = ic + lb + ready + isSink + isExt;
  if (key === btnState) return;
  btnState = key;
  $('#btnAct').innerHTML = `<span class="ic">${ic}</span><span class="lb">${lb}</span>`;
  $('#btnWork').innerHTML = isExt ? '<span class="ic">🧯</span><span class="lb">Xịt</span>' : isSink ? '<span class="ic">🧽</span><span class="lb">Rửa</span>' : '<span class="ic">🔪</span><span class="lb">Thái</span>';
  $('#btnWork').classList.toggle('ready', ready);
}

/* ======================= overlays ======================= */
const ovRoot = $('#overlay'), ovPool = new Map(), ovUsed = new Set(), _v = new THREE.Vector3();
function ovEl(key) {
  let e = ovPool.get(key);
  if (!e) { e = document.createElement('div'); ovRoot.appendChild(e); ovPool.set(key, e); }
  ovUsed.add(key);
  if (e.style.display) e.style.display = '';
  return e;
}
function ovSet(e, html, cls) {
  if (e._h !== html) { e.innerHTML = html; e._h = html; }
  if (e.className !== cls) e.className = cls;
}
function ov(key, x, y, z, html, cls = '') {
  _v.set(x, y, z).project(camera);
  if (_v.z > 1) return;
  const sx = (_v.x * 0.5 + 0.5) * VW, sy = (-_v.y * 0.5 + 0.5) * VH;
  if (sx < -80 || sx > VW + 80 || sy < -80 || sy > VH + 80) return;
  const e = ovEl(key);
  ovSet(e, html, 'ov ' + cls);
  e.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,-100%)`;
}
// chỉ hướng ở mép màn hình cho những thứ quan trọng nằm ngoài khung hình
function edge(key, x, y, z, html, cls = '') {
  _v.set(x, y, z).project(camera);
  let sx = (_v.x * 0.5 + 0.5) * VW, sy = (-_v.y * 0.5 + 0.5) * VH;
  const top = ($('#hud').offsetHeight || 62) + 30;
  if (sx > 20 && sx < VW - 20 && sy > top && sy < VH - 10) return;
  const arrow = sx < 20 ? '◀' : sx > VW - 20 ? '▶' : sy < top ? '▲' : '▼';
  sx = clamp(sx, 40, VW - 40); sy = clamp(sy, top + 6, VH - 30);
  const e = ovEl(key);
  ovSet(e, `<span>${arrow === '◀' || arrow === '▲' ? arrow : ''}${html}${arrow === '▶' || arrow === '▼' ? arrow : ''}</span>`, 'edge ' + cls);
  e.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,-50%)`;
}
function ovFlush() {
  for (const [k, e] of ovPool) if (!ovUsed.has(k) && e.style.display !== 'none') e.style.display = 'none';
  ovUsed.clear();
}
const bar = f => `<div class="bar"><i style="width:${Math.round(clamp(f, 0, 1) * 100)}%"></i></div>`;
const plateTag = c => `<span>${c.map(x => EMO[x]).join('')}</span>`;
const recipeKey = c => Object.keys(cfg.recipes).find(k => { const p = cfg.recipes[k].parts; return p.length === c.length && [...p].sort().join() === [...c].sort().join(); });

function drawOverlays(now) {
  if (phase !== 'playing' && phase !== 'ended') { ovFlush(); return; }
  for (const c of chars.values()) {
    const isMe = c.id === myId;
    const style = `border-color:${c.role.color}${isMe ? `;background:${c.role.color}` : ''}`;
    const bub = c.shout && c.shout.until > now ? `<span class="bub">${esc(c.shout.text)}</span>` : '';
    ov('n' + c.id, c.dx, 1.38, c.dy, `${bub}<span class="nm" style="${style}">${c.role.emoji} ${esc(c.name)}</span>`);
    const h = c.p?.h;
    if (h && h.k === 'plate' && h.c.length) ov('hp' + c.id, c.dx + Math.sin(c.da) * 0.3, 0.95, c.dy + Math.cos(c.da) * 0.3, plateTag(h.c), 'tag');
  }
  for (const n of npcs.values()) ov('npc' + n.id, n.dx, 1.3, n.dy, `<span class="nm npc">${n.icon} ${n.name}</span>`);
  for (const w of walkers.values()) ov('wk' + w.id, w.dx, 1.35, w.dy, `<span class="nm npc">${w.icon} ${w.name}</span>`);
  if (inspVis) ov('insp', inspVis.dx, 1.45, inspVis.dy, `<span class="nm insp">🕵️ THANH TRA ${Math.ceil(inspVis.left || 0)}s</span>`);
  // khách nói
  for (const v of custVis.values()) {
    if (v.say && v.say.until > now) ov('cs' + v.id, v.dx, v.sit ? 1.45 : 1.6, v.dy, `<span class="bub cust m${v.say.mood}">${esc(v.say.text)}</span>`);
    else if (v.kind === 'tam' && v.sit) ov('cs' + v.id, v.dx, 1.4, v.dy, '<span class="nm tam">🗣️ Bà Tám</span>');
  }
  // shipper chờ đơn
  for (const s of snap?.ship || []) {
    const v = custVis.get(s.c);
    if (!v || (v.say && v.say.until > now)) continue;
    ov('sh' + s.c, v.dx, 1.6, v.dy, `<div class="tbl ${s.p < 0.25 ? 'low' : s.p < 0.5 ? 'mid' : ''}"><span class="st">${cfg.recipes[s.r].icon}${bar(s.p)}</span><span class="nm ship">🛵 Shipper</span></div>`);
    if (phase === 'playing' && camMode === 'follow') edge('es' + s.c, v.dx, 0.8, v.dy, '🛵', s.p < 0.35 ? 'bad' : '');
  }
  // hàng chờ
  for (const q of snap?.q || []) {
    const v = custVis.get(q.c);
    if (v && !(v.say && v.say.until > now)) ov('q' + q.c, v.dx, 1.5, v.dy, `<div class="tbl ${q.p < 0.25 ? 'low' : q.p < 0.5 ? 'mid' : ''}"><span class="st">⏳${bar(q.p)}</span></div>`);
  }
  // bàn ăn
  for (const tb of snap?.tb || []) {
    const x = (tb.i % MW) + 0.5, z = ((tb.i / MW) | 0) + 0.5;
    let st = '', cls = '';
    const lv = tb.p < 0.25 ? ' low' : tb.p < 0.5 ? ' mid' : '';
    if (tb.st === 'reading' || tb.st === 'seating') st = '📖';
    else if (tb.st === 'order') { st = `🙋${bar(tb.p)}`; cls = 'hand' + lv; }
    else if (tb.st === 'wait') { st = `${tb.l.map(d => cfg.recipes[d].icon).join('')}${bar(tb.p)}`; cls = lv; }
    else if (tb.st === 'eat') st = '😋';
    else if (tb.st === 'dirty') st = `🍽️×${tb.d}`;
    const vip = { vip: '👑 ', bday: '🎂 ', tam: '🗣️ ' }[tb.k] || '';
    ov('tb' + tb.num, x, 1.25, z, `<div class="tbl ${cls}">${st ? `<span class="st">${vip}${st}</span>` : ''}<span class="no">Bàn ${tb.num}</span></div>`);
    if (phase === 'playing' && camMode === 'follow') {
      if (tb.st === 'order') edge('eo' + tb.num, x, 0.8, z, `🙋${tb.num}`, tb.p < 0.35 ? 'bad' : '');
      else if (tb.st === 'wait' && tb.p < 0.3) edge('eo' + tb.num, x, 0.8, z, `😡${tb.num}`, 'bad');
    }
  }
  for (let i = 0; i < tiles.length; i++) {
    const info = tiles[i];
    if (!info) continue;
    const s = tileState[i], p = info.anchor.position;
    if (s.fire) {
      if (s.ext > 0) ov('t' + i, p.x, p.y + 0.8, p.z, bar(s.ext));
      if (phase === 'playing' && camMode === 'follow') edge('ef' + i, p.x, p.y, p.z, '🔥', 'bad');
      continue;
    }
    switch (info.type) {
      case 'board':
        if (s.item?.k === 'ing' && s.item.s === 'raw' && s.item.p > 0) ov('t' + i, p.x, p.y + 0.5, p.z, bar(s.item.p));
        else if (s.item?.k === 'plate' && s.item.c.length) ov('t' + i, p.x, p.y + 0.35, p.z, plateTag(s.item.c), 'tag');
        break;
      case 'sink':
        if (s.prog > 0) ov('t' + i, p.x, p.y + 0.5, p.z, bar(s.prog));
        else if (s.n > 0) ov('t' + i, p.x, p.y + 0.45, p.z, `<span>🍽️×${s.n}</span>`, 'tag');
        break;
      case 'rack':
        if (s.n > 1) ov('t' + i, p.x, p.y + 0.5, p.z, `<span>×${s.n}</span>`, 'tag');
        break;
      case 'stove': {
        const c = s.item; if (!c) break;
        const st = contStatus(c), C = cfg.cook[c.k];
        if (st === 'fill' && c.c.length) ov('t' + i, p.x, p.y + 0.55, p.z, `<span>${EMO[c.c[0]]} ${c.c.length}/3</span>`, 'tag');
        else if (st === 'cooking') ov('t' + i, p.x, p.y + 0.6, p.z, bar(c.p / C.cook), 'cook');
        else if (st === 'done') ov('t' + i, p.x, p.y + 0.6, p.z, '<span>✅</span>', 'icon');
        else if (st === 'warn') ov('t' + i, p.x, p.y + 0.6, p.z, '<span>⚠️</span>', 'icon flash');
        else if (st === 'burnt') ov('t' + i, p.x, p.y + 0.6, p.z, '<span>⚫</span>', 'icon flash');
        break;
      }
      case 'pass':
        if (s.item?.k === 'plate' && s.item.c.length) {
          const key = recipeKey(s.item.c);
          const tb = key && snap?.tb?.find(t => t.st === 'wait' && t.l.includes(key));
          ov('t' + i, p.x, p.y + 0.35, p.z, `<span>${s.item.c.map(x => EMO[x]).join('')}${tb ? ` → Bàn ${tb.num}` : ''}</span>`, 'tag');
        } else if (s.item) ov('t' + i, p.x, p.y + 0.5, p.z, '<span>⚠️ Quầy ra món</span>', 'tag');
        break;
      case 'counter': case 'crate':
        if (info.type === 'crate' && snap?.stock && CRATE[MAP[(i / MW) | 0][i % MW]] === snap.stock.ing) ov('t' + i, p.x, p.y + 0.6, p.z, '<span>❌📦</span>', 'icon flash');
        else if (s.item?.k === 'plate' && s.item.c.length) ov('t' + i, p.x, p.y + 0.35, p.z, plateTag(s.item.c), 'tag');
        else if (s.item?.k === 'ext') ov('t' + i, p.x, p.y + 0.6, p.z, `<span>🧯×${s.item.n}</span>`, 'tag');
        break;
    }
  }
  ovFlush();
}

/* ======================= main loop ======================= */
function animateChar(c, dt, t) {
  const mv = Math.hypot(c.dx - c.px, c.dy - c.py) / Math.max(dt, 1e-3);
  c.px = c.dx; c.py = c.dy;
  c.spd += (Math.min(mv, 8) - c.spd) * Math.min(1, dt * 10);
  const sit = !!c.sit;
  c.g.position.set(c.dx, sit ? 0.26 : 0, c.dy);
  c.g.rotation.y = c.da;
  const w = sit ? 0 : clamp(c.spd / 4, 0, 1), ph = t * 15 + (Number(c.id) || (c.cid || 0));
  c.body.position.y = Math.abs(Math.sin(ph)) * 0.07 * w;
  c.body.rotation.z = Math.sin(ph) * 0.07 * w;
  c.body.rotation.x = c.spd > 7 ? 0.25 : 0.05 * w;
  if (sit) {
    c.legL.rotation.x = c.legR.rotation.x = -Math.PI / 2;
    c.legL.position.set(-0.09, 0.02, 0.1); c.legR.position.set(0.09, 0.02, 0.1);
  } else {
    c.legL.rotation.x = c.legR.rotation.x = 0;
    c.legL.position.set(-0.09, 0.08, Math.sin(ph) * 0.09 * w);
    c.legR.position.set(0.09, 0.08, -Math.sin(ph) * 0.09 * w);
  }
  const holding = !!c.p?.h, working = !!c.p?.w;
  const push = c.id === myId && actAnim > 0 ? 0.08 : 0;
  if (working) {
    const s = Math.abs(Math.sin(t * 18));
    c.handR.position.set(0.13, 0.44 + s * 0.15, 0.28);
    c.handL.position.set(-0.15, 0.42, 0.26);
  } else if (holding) {
    c.handL.position.set(-0.18, 0.45, 0.26 + push);
    c.handR.position.set(0.18, 0.45, 0.26 + push);
  } else if (sit) {
    const angry = c.mood === 2 ? Math.abs(Math.sin(t * 14)) * 0.12 : 0;
    c.handL.position.set(-0.2, 0.42 + angry, 0.22);
    c.handR.position.set(0.2, 0.42, 0.22);
  } else {
    c.handL.position.set(-0.25, 0.36, Math.sin(ph) * 0.1 * w + push);
    c.handR.position.set(0.25, 0.36, -Math.sin(ph) * 0.1 * w + push);
  }
  c.hold.position.z = 0.32 + push;
}
function follow(v, k) {
  v.dx += (v.tx - v.dx) * k; v.dy += (v.ty - v.dy) * k;
  v.da += angDiff(v.da, v.ta) * k;
}

let last = performance.now(), workSfxT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (!world) return;

  if (phase === 'playing' && me.inited) {
    updateMe(dt);
    sendPos(now);
    target = findTarget();
    const held = myState()?.h, hk = held?.k;
    ratTarget = !hk || hk === 'mop' ? findRat() : null;
    shipTarget = hk === 'plate' && held.c.length ? findShipper() : null;
    updateButtons();
    actAnim = Math.max(0, actAnim - dt);
    const mine = myState();
    if (mine?.w && target >= 0) {
      workSfxT -= dt;
      if (workSfxT <= 0) { workSfxT = 0.2; tiles[target]?.type === 'sink' ? SFX.wash() : SFX.chop(); }
    }
  } else { target = -1; ratTarget = null; shipTarget = null; }
  updateCam(Math.min(1, dt * 6));

  const ringOn = shipTarget || ratTarget;
  if (ringOn) {
    ratRing.visible = true;
    ratRing.position.set(ringOn.dx, 0.02, ringOn.dy);
    ratRing.scale.setScalar(1 + Math.sin(t * 10) * 0.12);
  } else ratRing.visible = false;

  if (target >= 0) {
    const hi = tableOf(target) >= 0 ? tableOf(target) : target;
    const info = tiles[hi];
    highlight.visible = true;
    highlight.position.set((hi % MW) + 0.5, info.top + 0.012, ((hi / MW) | 0) + 0.5);
    highlight.material.opacity = 0.3 + Math.sin(t * 8) * 0.12;
  } else highlight.visible = false;

  const k = 1 - Math.exp(-dt * 14);
  for (const c of chars.values()) {
    if (c.id === myId && me.inited && phase === 'playing') {
      c.dx = me.x; c.dy = me.y;
      c.da += angDiff(c.da, me.a) * Math.min(1, dt * 20);
    } else follow(c, k);
    animateChar(c, dt, t);
  }
  for (const n of npcs.values()) animateChar(n, dt, t);
  for (const w of walkers.values()) { follow(w, k); animateChar(w, dt, t); }
  for (const v of custVis.values()) { if (!v.sit) follow(v, k); else v.da += angDiff(v.da, v.ta) * k; animateChar(v, dt, t); }
  if (inspVis) { follow(inspVis, k); animateChar(inspVis, dt, t); }
  for (const v of ratVis.values()) {
    follow(v, k);
    v.g.position.set(v.dx, Math.abs(Math.sin(t * 22 + v.dx)) * 0.03, v.dy);
    v.g.rotation.y = v.da;
    v.tail.rotation.y = Math.sin(t * 14) * 0.5;
  }
  if (catVis) {
    follow(catVis, k);
    catVis.g.position.set(catVis.dx, 0, catVis.dy);
    catVis.g.rotation.y = catVis.da;
    catVis.tail.rotation.z = Math.sin(t * 4) * 0.4;
  }
  // cúp điện: tối đèn
  const lk = snap?.out > 0 && phase === 'playing' ? 0.3 : 1;
  lightK += (lk - lightK) * Math.min(1, dt * 3);
  hemi.intensity = 1.5 * lightK; sun.intensity = 2.2 * lightK;
  for (const o of animated) o.userData.tick(t);

  drawOverlays(now);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
resize();
