'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const PUB = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/* ===================== STATIC FILES ===================== */
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end(); }
  if (pathname === '/') pathname = '/index.html';
  const file = path.join(PUB, path.normalize(pathname));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

/* ===================== GAME DATA ===================== */
// Bản đồ nhà hàng (nhìn từ trên xuống). Mỗi ký tự = 1 ô. Bên trái là bếp, bên phải là phòng ăn.
//  . sàn   # bàn bếp   p bàn bếp có sẵn đĩa   T/L/O/M/B thùng cà chua/rau/hành/thịt/bánh mì
//  C thớt  S bếp có nồi  F bếp có chảo  W bồn rửa  R kệ đĩa sạch  G thùng rác
//  P quầy ra món (bồi bàn lấy món ở đây)   w tường phòng ăn   t bàn ăn   h ghế   E cửa ra vào
const MAP = [
  '##TLOMB###SSFF##wwwwwwwwwwwwww',
  '#..............#.............w',
  'C................hth.hth.hth.w',
  'C....##p##.....P.............w',
  'G....#####.....P.............E',
  'C..............P.hth.hth.hth.w',
  '#............................w',
  '#..............#.............w',
  '##p####WWR#p####wwwwwwwwwwwwww',
];
const MW = MAP[0].length, MH = MAP.length;
if (MAP.some(r => r.length !== MW)) throw new Error('MAP rows must have equal length');

const TYPE = {
  '.': 'floor', '#': 'counter', p: 'counter', T: 'crate', L: 'crate', O: 'crate', M: 'crate', B: 'crate',
  C: 'board', S: 'stove', F: 'stove', W: 'sink', R: 'rack', G: 'trash',
  P: 'pass', w: 'wall', t: 'table', h: 'chair', E: 'door',
};
const CRATE = { T: 'tomato', L: 'lettuce', O: 'onion', M: 'meat', B: 'bread' };
const PREP_TILES = [7, 8, 9];          // 3 ô bàn trống hàng trên cùng: NV sơ chế bày đồ ở đây
const MOP_START = 8 * MW + 12;         // cây lau nhà có sẵn
const DOOR = (() => { for (let y = 0; y < MH; y++) { const x = MAP[y].indexOf('E'); if (x >= 0) return [x, y]; } })();
const HOLES = [[1.5, 1.5], [14.5, 1.5], [1.5, 7.5], [14.5, 7.5], [17.5, 7.5], [28.5, 1.5]]; // hang chuột
const CAT_HOME = [12.5, 6.5];
const WAITER_HOME = [16.5, 4.5], HOST_HOME = [16.5, 1.5];
const CHARM = { waiter: 0.4, host: 0.7 }, CHARM_BONUS = 0.25; // tỷ lệ khách vui khi NV ghi món, và % kiên nhẫn được cộng
const QUEUE = [[28, 4], [28, 3], [28, 5], [27, 4], [27, 3], [27, 5], [26, 4], [26, 3], [26, 5], [25, 4]];

const RECIPES = {
  salad:  { name: 'Salad rau',    icon: '🥗', parts: ['lettuce', 'tomato'],         pts: 25, time: 100, bonus: 15 },
  soupT:  { name: 'Súp cà chua',  icon: '🍲', parts: ['soupT'],                     pts: 35, time: 120, bonus: 18 },
  soupO:  { name: 'Súp hành',     icon: '🥣', parts: ['soupO'],                     pts: 35, time: 120, bonus: 18 },
  banhmi: { name: 'Bánh mì thịt', icon: '🥖', parts: ['bread', 'meat', 'lettuce'], pts: 50, time: 140, bonus: 22 },
};
const ROLES = {
  chop:  { name: 'Thợ thái', emoji: '🔪', color: '#e5484d', desc: 'Thái nhanh gấp đôi' },
  cook:  { name: 'Bếp chính', emoji: '🍳', color: '#f59e0b', desc: 'Nồi mày bỏ đủ đồ chín nhanh x1.5' },
  wash:  { name: 'Rửa bát', emoji: '🧽', color: '#3b82f6', desc: 'Rửa nhanh gấp đôi' },
  serve: { name: 'Bưng bê', emoji: '🏃', color: '#22c55e', desc: 'Chạy nhanh hơn 20%, khách kiên nhẫn hơn' },
};
const SHOP = {
  waiter:    { cat: 'staff', icon: '🤵', name: 'Bồi bàn',           desc: 'Lấy món ở quầy RA MÓN 🛎️ bưng đúng bàn, ghi món (40% khách vui, chờ lâu hơn), dọn đĩa bẩn về bồn', price: 70, wage: 14 },
  host:      { cat: 'staff', icon: '📝', name: 'NV tiếp khách',     desc: 'Chuyên ghi món, khéo ăn nói: 70% khách vui, chờ lâu hơn', price: 60, wage: 12 },
  wash:      { cat: 'staff', icon: '🧽', name: 'NV rửa bát',        desc: 'Tự rửa đĩa bẩn trong bồn', price: 60, wage: 12 },
  chop:      { cat: 'staff', icon: '🔪', name: 'Phụ bếp thái',      desc: 'Tự thái đồ sống đặt trên thớt', price: 70, wage: 14 },
  prep:      { cat: 'staff', icon: '🧺', name: 'NV sơ chế',         desc: 'Bày sẵn nguyên liệu đã thái lên 3 bàn trên cùng', price: 90, wage: 18 },
  cat:       { cat: 'staff', icon: '🐱', name: 'Nuôi mèo',          desc: 'Tự đi bắt chuột', price: 50, wage: 5 },
  ext:       { cat: 'item',  icon: '🧯', name: 'Bình cứu hỏa',      desc: 'Cầm rồi bấm Xịt vào chỗ cháy (4 lần)', price: 30 },
  poison:    { cat: 'item',  icon: '🧪', name: 'Thuốc diệt chuột',  desc: 'Diệt sạch chuột + chặn chuột 45s', price: 35 },
  mop:       { cat: 'item',  icon: '🧹', name: 'Cây lau nhà',       desc: 'Cầm đi qua chỗ bẩn là sạch', price: 15 },
  plate:     { cat: 'item',  icon: '🍽️', name: 'Thêm 1 đĩa',        desc: 'Đĩa sạch mới ra kệ (tối đa 10)', price: 25 },
  time:      { cat: 'item',  icon: '⏳', name: 'Mở cửa thêm 30s',   desc: '+30 giây đồng hồ', price: 60 },
  license:   { cat: 'item',  icon: '📋', name: 'Giấy chứng nhận ATTP', desc: 'Lần thanh tra tới tự động đạt', price: 70 },
  gen:       { cat: 'up',    icon: '🔋', name: 'Máy phát điện',     desc: 'Không sợ cúp điện nữa', price: 90 },
  shoes:     { cat: 'up',    icon: '👟', name: 'Giày chạy nhanh',   desc: 'Cả đội chạy nhanh hơn 15%', price: 80 },
  cooker:    { cat: 'up',    icon: '♨️', name: 'Bếp ga xịn',        desc: 'Nồi và chảo chín nhanh hơn 30%', price: 100 },
  music:     { cat: 'up',    icon: '🎵', name: 'Nhạc nhẹ phòng ăn', desc: 'Khách kiên nhẫn hơn 20%', price: 90 },
  sprinkler: { cat: 'up',    icon: '🚿', name: 'Vòi phun nước',     desc: 'Lửa tự tắt sau 6s, không lan', price: 150 },
};
const EVENTS = {
  rats:   { icon: '🐀', name: 'Chuột' },
  rush:   { icon: '🔥', name: 'Giờ cao điểm' },
  vip:    { icon: '👑', name: 'Khách VIP' },
  fire:   { icon: '🧯', name: 'Cháy lò' },
  outage: { icon: '🔌', name: 'Cúp điện' },
  insp:   { icon: '🕵️', name: 'Thanh tra' },
};
const COOK = { pot: { cook: 9, burn: 10 }, pan: { cook: 6, burn: 9 } };
const CHOP_TIME = 2.2, WASH_TIME = 2.0, COUNTDOWN = 3;
const ROUND_TIME = Number(process.env.ROUND) || 360; // giây lúc bắt đầu (mỗi món giao xong được cộng thêm)
const LEVEL_EVERY = 180, FIRST_EVENT = 120;
const SPEED = Number(process.env.SPEED) || 1; // chỉ dùng để test: tua nhanh thời gian
const START_MONEY = Number(process.env.MONEY) || 0;
const MAX_PLAYERS = 8, REACH = 1.7, MAX_PLATES = 10, MAX_DIRT = 15, START_PLATES = 5, EAT_TIME = 7;
const STARS = [300, 800, 1600];
const SPAWNS = [[3.5, 2.5], [12.5, 2.5], [3.5, 6.5], [12.5, 6.5], [8, 6.5], [8, 1.5], [1.5, 4.5], [14.5, 4.5]];

/* ===================== HELPERS ===================== */
const rooms = new Map();
let pidSeq = 0, entSeq = 0;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.random() * arr.length | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const numFix = (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg, numFix)); }
function broadcast(r, msg) {
  const s = JSON.stringify(msg, numFix);
  for (const p of r.players.values()) if (p.ws.readyState === 1) p.ws.send(s);
}
const emit = (r, ev) => broadcast(r, { t: 'ev', ...ev });
const tell = (p, ev) => send(p.ws, { t: 'ev', ...ev });
const isWalk = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && (MAP[y][x] === '.' || MAP[y][x] === 'E');
const isFloor = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && MAP[y][x] === '.';
const cellOf = (x, y) => Math.floor(y) * MW + Math.floor(x);
const cellCenter = c => [(c % MW) + 0.5, ((c / MW) | 0) + 0.5];

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.random() * A.length | 0]).join(''); } while (rooms.has(c));
  return c;
}

function createRoom() {
  const r = { code: makeCode(), players: new Map(), host: null, state: 'lobby', tiles: [] };
  rooms.set(r.code, r);
  return r;
}

function lobbyMsg(r) {
  return { t: 'lobby', host: r.host, state: r.state, players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, role: p.role })) };
}

function freeRole(r) {
  const used = new Set([...r.players.values()].map(p => p.role));
  const keys = Object.keys(ROLES);
  return keys.find(k => !used.has(k)) || keys[r.players.size % keys.length];
}

const cleanName = n => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
const newPlate = () => ({ k: 'plate', c: [] });

// BFS trên các ô đi được. Trả về danh sách ô (index) sau ô xuất phát tới đích.
function bfs(from, goals) {
  if (goals.has(from)) return [];
  const prev = new Map([[from, -1]]);
  const q = [from];
  while (q.length) {
    const c = q.shift();
    const x = c % MW, y = (c / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, n = ny * MW + nx;
      if (!isWalk(nx, ny) || prev.has(n)) continue;
      prev.set(n, c);
      if (goals.has(n)) {
        const p = [n];
        let k = c;
        while (k !== from) { p.unshift(k); k = prev.get(k); }
        return p;
      }
      q.push(n);
    }
  }
  return null;
}
const floorCells = [];
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (MAP[y][x] === '.') floorCells.push(y * MW + x);
const kitchenFloor = floorCells.filter(c => c % MW < 15);
function adjWalk(i) {
  const x = i % MW, y = (i / MW) | 0, s = new Set();
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (isFloor(x + dx, y + dy)) s.add((y + dy) * MW + x + dx);
  return s;
}
const pathTo = (e, goals) => bfs(cellOf(e.x, e.y), goals instanceof Set ? goals : new Set([goals]));

function walk(e, speed, dt) {
  if (!e.path || !e.path.length) return true;
  const [tx, ty] = cellCenter(e.path[0]);
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  const step = speed * dt;
  if (d <= step) { e.x = tx; e.y = ty; e.path.shift(); }
  else { e.x += (dx / d) * step; e.y += (dy / d) * step; e.a = Math.atan2(dx, dy); }
  return !e.path.length;
}

/* ===================== GAME SETUP ===================== */
function resetGame(r) {
  r.tiles = [];
  r.tables = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const ch = MAP[y][x];
    const t = { type: TYPE[ch], item: null, n: 0, prog: 0, fire: 0, ext: 0, spread: 0 };
    if (CRATE[ch]) t.ing = CRATE[ch];
    if (ch === 'p') t.item = newPlate();
    if (ch === 'S') t.item = { k: 'pot', c: [], p: 0, burnt: false, fast: false, bt: 0 };
    if (ch === 'F') t.item = { k: 'pan', c: [], p: 0, burnt: false, fast: false, bt: 0 };
    if (ch === 'R') t.n = START_PLATES - 3;
    if (ch === 't') {
      t.tb = r.tables.length;
      r.tables.push({ i: y * MW + x, num: r.tables.length + 1, chairs: [y * MW + x - 1, y * MW + x + 1], party: null, food: [], dirty: 0, claim: null, oclaim: null });
    }
    r.tiles.push(t);
  }
  r.tiles[MOP_START].item = { k: 'mop' };
  Object.assign(r, {
    orders: [], money: START_MONEY, earned: 0, rep: 100, time: ROUND_TIME, cd: COUNTDOWN, elapsed: 0, level: 1,
    orderSeq: 0, lastDish: null, served: 0, failed: 0, plates: START_PLATES,
    customers: [], parties: [], nextCust: 1,
    rats: [], dirt: new Set(), ratBlock: 0, rush: 0, outage: 0, insp: null, seenInsp: false,
    nextEvent: FIRST_EVENT, eventCount: 0, eventsSeen: 0, wageT: 0,
    staff: {
      waiter: { on: false, x: WAITER_HOME[0], y: WAITER_HOME[1], a: 0, path: [], task: null, carry: 0, plate: null, think: 0, pause: 0 },
      host: { on: false, x: HOST_HOME[0], y: HOST_HOME[1], a: 0, path: [], task: null, think: 0 },
      wash: { on: false, prog: 0, busy: false }, chop: { on: false, busy: false }, prep: { on: false, t: 4, busy: 0 },
      cat: { on: false, x: CAT_HOME[0], y: CAT_HOME[1], a: 0, path: [], think: 0 },
    },
    up: { gen: false, shoes: false, cooker: false, music: false, sprinkler: false, license: false },
  });
  let i = 0;
  for (const p of r.players.values()) spawn(p, i++);
}

function spawn(p, i) {
  const s = SPAWNS[i % SPAWNS.length];
  Object.assign(p, { x: s[0], y: s[1], a: 0, holding: null, work: null, spawned: true, st: { sv: 0, od: 0, ch: 0, wa: 0, rk: 0, fx: 0 } });
}

/* ===================== KITCHEN RULES ===================== */
const tileAt = (r, x, y) => (x >= 0 && y >= 0 && x < MW && y < MH ? r.tiles[y * MW + x] : null);
const findTile = (r, type) => r.tiles.find(t => t.type === type);
const isFull = c => c.c.length === (c.k === 'pot' ? 3 : 1);

function contDish(c) {
  if (!isFull(c) || c.burnt || c.p < COOK[c.k].cook) return null;
  return c.k === 'pot' ? (c.c[0] === 'tomato' ? 'soupT' : 'soupO') : 'meat';
}
function clearCont(c) { Object.assign(c, { c: [], p: 0, burnt: false, fast: false, bt: 0 }); }

function contAccepts(c, it) {
  if (it.k !== 'ing' || it.s !== 'chopped' || c.burnt || isFull(c)) return false;
  if (c.k === 'pot') return (it.t === 'tomato' || it.t === 'onion') && (!c.c.length || c.c[0] === it.t);
  return it.t === 'meat';
}

const plateComp = it => (it && it.k === 'ing' && it.s === 'chopped' && ['tomato', 'lettuce', 'bread'].includes(it.t) ? it.t : null);

function addToPlate(pl, c) {
  if (!c || pl.c.length >= 3 || pl.c.includes(c)) return false;
  if (pl.c.some(x => x.startsWith('soup'))) return false;
  if (c.startsWith('soup') && pl.c.length) return false;
  pl.c.push(c);
  pl.c.sort();
  return true;
}

function whyNot(it) {
  if (it.k !== 'ing') return 'Không ghép được';
  if (it.s === 'raw') return 'Phải thái trước đã! 🔪';
  if (it.t === 'meat') return 'Thịt phải áp chảo trước 🍳';
  if (it.t === 'onion') return 'Hành để nấu súp trong nồi 🍲';
  return 'Đĩa này không thêm được nữa';
}

const sameParts = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const recipeOf = comps => Object.keys(RECIPES).find(k => sameParts(RECIPES[k].parts, comps));

function whack(r, p) {
  const fx = Math.sin(p.a), fy = Math.cos(p.a);
  let best = null, bd = 1.15;
  for (const rat of r.rats) {
    const dx = rat.x - p.x, dy = rat.y - p.y, d = Math.hypot(dx, dy);
    if (d < bd && (d < 0.35 || (dx * fx + dy * fy) / d > 0.2)) { best = rat; bd = d; }
  }
  if (!best) return false;
  best.hp--;
  if (best.hp <= 0) {
    r.rats.splice(r.rats.indexOf(best), 1);
    p.st.rk++;
    r.money += 3; r.earned += 3;
    emit(r, { e: 'ratDie', x: best.x, y: best.y, id: p.id });
  } else {
    best.path = pathTo(best, pick(floorCells)) || [];
    best.target = null; best.eatT = 0;
    emit(r, { e: 'whack', x: best.x, y: best.y });
  }
  return true;
}

/* ===================== CUSTOMERS ===================== */
const partyById = (r, id) => r.parties.find(p => p.id === id);
const levelScale = r => Math.max(0.6, 1 - (r.level - 1) * 0.08);
const patienceMul = r => (r.up.music ? 1.2 : 1) * ([...r.players.values()].some(p => p.role === 'serve') ? 1.1 : 1);

function say(r, party, k, extra = {}) {
  const live = party.members.map(id => r.customers.find(c => c.id === id)).filter(Boolean);
  if (!live.length) return;
  const c = pick(live);
  const mood = { grumble: 1, angry: 2, leave: 2, wrong: 1, happy: 3, order: 0 }[k] ?? 0;
  for (const m of live) m.mood = mood;
  emit(r, { e: 'say', cid: c.id, k, i: Math.random() * 1000 | 0, ...extra });
}

function spawnParty(r, vip) {
  const two = vip ? Math.random() < 0.5 : Math.random() < Math.min(0.65, 0.15 + r.level * 0.15);
  const pat = 50 * patienceMul(r) * (vip ? 0.7 : 1);
  const party = { id: ++entSeq, n: two ? 2 : 1, vip: !!vip, members: [], table: null, st: 'queue', pat, patMax: pat, warned: 0, grumbleT: rand(4, 8), dishes: [], left: [] };
  for (let k = 0; k < party.n; k++) {
    const c = { id: ++entSeq, x: DOOR[0] + 0.5, y: DOOR[1] + 0.5 + (k ? 0.3 : -0.1), a: -Math.PI / 2, path: [], party: party.id, col: Math.random() * 8 | 0, sit: false, seat: null, mood: 0, leaving: false };
    r.customers.push(c);
    party.members.push(c.id);
  }
  r.parties.push(party);
  emit(r, { e: 'enter', vip: party.vip });
  if (!seatParty(r, party)) layoutQueue(r);
}

function seatParty(r, party) {
  const t = r.tables.find(tb => !tb.party && !tb.dirty && !r.tiles[tb.i].fire);
  if (!t) return false;
  t.party = party.id;
  party.table = r.tables.indexOf(t);
  party.st = 'seating';
  party.members.forEach((id, k) => {
    const c = r.customers.find(m => m.id === id);
    c.seat = k;
    c.path = pathTo(c, adjWalk(t.chairs[k])) || [];
  });
  return true;
}

function layoutQueue(r) {
  let slot = 0;
  for (const party of r.parties) {
    if (party.st !== 'queue') continue;
    for (const id of party.members) {
      const c = r.customers.find(m => m.id === id);
      const q = QUEUE[Math.min(slot++, QUEUE.length - 1)];
      c.path = pathTo(c, q[1] * MW + q[0]) || [];
    }
  }
}

function takeOrder(r, party, p, by) {
  const pool = r.elapsed < 60 ? ['salad', 'soupT'] : r.elapsed < 150 ? ['salad', 'soupT', 'soupO'] : Object.keys(RECIPES);
  const dishes = [];
  for (let k = 0; k < party.n; k++) {
    let d = pick(pool);
    if (d === r.lastDish && Math.random() < 0.5) d = pick(pool);
    r.lastDish = d;
    dishes.push(d);
  }
  const t = r.tables[party.table];
  party.dishes = dishes; party.left = [...dishes];
  party.st = 'wait';
  party.patMax = party.pat = (Math.max(...dishes.map(d => RECIPES[d].time)) + 20 * (party.n - 1)) * levelScale(r) * patienceMul(r) * (party.vip ? 0.7 : 1);
  party.warned = 0;
  for (const d of dishes) r.orders.push({ id: ++r.orderSeq, r: d, t: t.num, party: party.id, left: party.pat, max: party.patMax, vip: party.vip });
  if (p) p.st.od++;
  emit(r, { e: 'order', tn: t.num, id: p ? p.id : 0, by: by || '' });
  say(r, party, 'order', { r: dishes[0] });
  // nhân viên khéo ăn nói: khách vui, chịu chờ lâu hơn
  if (by && Math.random() < CHARM[by]) {
    const bonus = party.patMax * CHARM_BONUS;
    party.patMax += bonus; party.pat += bonus;
    for (const o of r.orders) if (o.party === party.id) { o.left = party.pat; o.max = party.patMax; }
    emit(r, { e: 'charm', tn: t.num, by, pct: Math.round(CHARM_BONUS * 100) });
  }
}

function partyLeave(r, party, angry) {
  const t = party.table != null ? r.tables[party.table] : null;
  if (t) {
    t.dirty += t.food.length;
    t.food = [];
    t.party = null;
  }
  r.orders = r.orders.filter(o => o.party !== party.id);
  party.st = 'gone';
  for (const id of party.members) {
    const c = r.customers.find(m => m.id === id);
    if (!c) continue;
    c.sit = false; c.leaving = true;
    if (c.seat != null && t) { const [cx, cy] = [...adjWalk(t.chairs[c.seat])].map(cellCenter)[0] || [c.x, c.y]; c.x = cx; c.y = cy; }
    c.path = pathTo(c, DOOR[1] * MW + DOOR[0]) || [];
  }
  r.parties.splice(r.parties.indexOf(party), 1);
  if (angry) {
    r.rep -= party.vip ? 15 : 10;
    r.failed++;
    say(r, party, 'leave');
    emit(r, { e: 'angry', tn: t ? t.num : 0, vip: party.vip });
  }
  layoutQueue(r);
}

function deliver(r, p, t, party) {
  const h = p.holding;
  const key = recipeOf(h.c);
  if (!key) return tell(p, { e: 'hint', msg: 'Món này không có trong thực đơn! 🤢' });
  if (!party || party.st !== 'wait') return tell(p, { e: 'hint', msg: party ? 'Bàn này chưa gọi món' : 'Bàn trống mà' });
  if (!party.left.includes(key)) { say(r, party, 'wrong'); return tell(p, { e: 'wrong', msg: `Bàn ${t.num} không gọi ${RECIPES[key].name}!` }); }
  p.holding = null;
  p.st.sv++;
  serveDish(r, t, party, key, p.id);
}

// đặt 1 món lên bàn (dùng chung cho người chơi và bồi bàn)
function serveDish(r, t, party, key, by) {
  party.left.splice(party.left.indexOf(key), 1);
  const oi = r.orders.findIndex(o => o.party === party.id && o.r === key);
  if (oi >= 0) r.orders.splice(oi, 1);
  t.food.push(key);
  emit(r, { e: 'deliver', tn: t.num, id: by });
  if (!party.left.length) {
    party.st = 'eat'; party.eatT = EAT_TIME;
    party.payFrac = party.pat / party.patMax;
    if (party.payFrac > 0.4) say(r, party, 'happy');
  }
}

function payParty(r, party) {
  const t = r.tables[party.table];
  let pts = 0, bonus = 0;
  for (const d of party.dishes) {
    const R = RECIPES[d];
    pts += R.pts + Math.round(R.pts * 0.6 * party.payFrac);
    bonus += R.bonus;
  }
  if (party.vip) { pts *= 3; bonus *= 2; }
  if (r.rush > 0) pts = Math.round(pts * 1.5);
  r.money += pts; r.earned += pts; r.served += party.dishes.length;
  r.time += bonus;
  r.rep = Math.min(100, r.rep + (party.vip ? 8 : 3) * party.dishes.length);
  emit(r, { e: 'pay', tn: t.num, pts, bonus, vip: party.vip, tip: party.payFrac > 0.6 });
  if (Math.random() < 0.5) say(r, party, 'happy');
  partyLeave(r, party, false);
}

function complain(r, party, dt) {
  const f = party.pat / party.patMax;
  if (f < 0.5 && party.warned < 1) { party.warned = 1; say(r, party, 'grumble'); return; }
  if (f < 0.25 && party.warned < 2) { party.warned = 2; say(r, party, 'angry'); return; }
  party.grumbleT -= dt;
  if (f < 0.4 && party.grumbleT <= 0) { party.grumbleT = rand(8, 13); say(r, party, f < 0.2 ? 'angry' : 'grumble'); }
}

function tickCustomers(r, dt) {
  // di chuyển khách
  for (let i = r.customers.length - 1; i >= 0; i--) {
    const c = r.customers[i];
    if (c.path.length) { walk(c, 1.9, dt); continue; }
    if (c.leaving) { r.customers.splice(i, 1); continue; }
    if (c.seat != null && !c.sit) {
      const party = partyById(r, c.party);
      if (!party || party.table == null) continue;
      const t = r.tables[party.table];
      const [cx, cy] = cellCenter(t.chairs[c.seat]);
      c.x = cx; c.y = cy; c.sit = true;
      c.a = c.seat === 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  // trạng thái từng nhóm khách
  for (const party of [...r.parties]) {
    switch (party.st) {
      case 'queue':
        party.pat -= dt;
        complain(r, party, dt);
        if (party.pat <= 0) partyLeave(r, party, true);
        else if (seatParty(r, party)) layoutQueue(r);
        break;
      case 'seating': {
        const seated = party.members.every(id => { const c = r.customers.find(m => m.id === id); return c && c.sit; });
        if (seated) { party.st = 'reading'; party.readT = rand(3, 5); }
        break;
      }
      case 'reading':
        party.readT -= dt;
        if (party.readT <= 0) {
          party.st = 'order';
          party.patMax = party.pat = 40 * patienceMul(r) * (party.vip ? 0.7 : 1);
          party.warned = 0;
          emit(r, { e: 'hand', tn: r.tables[party.table].num });
        }
        break;
      case 'order': case 'wait':
        party.pat -= dt;
        complain(r, party, dt);
        if (party.pat <= 0) partyLeave(r, party, true);
        break;
      case 'eat':
        party.eatT -= dt;
        if (party.eatT <= 0) payParty(r, party);
        break;
    }
  }
  for (const o of r.orders) { const pt = partyById(r, o.party); if (pt) { o.left = pt.pat; o.max = pt.patMax; } }

  // khách mới tới
  r.nextCust -= dt;
  if (r.nextCust <= 0) {
    const active = r.parties.length;
    if (active < r.tables.length + 3) spawnParty(r, false);
    r.nextCust = Math.max(12, 34 - r.players.size * 3 - (r.level - 1) * 2.5) * (r.rush > 0 ? 0.5 : 1) * rand(0.8, 1.2);
  }
}

/* ===================== INTERACT ===================== */
function interact(r, p, x, y) {
  const h = p.holding;
  if ((!h || h.k === 'mop') && whack(r, p)) return;
  let t = tileAt(r, x, y);
  if (!t || t.type === 'floor' || t.type === 'wall' || t.type === 'door') return;
  if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) > REACH) return;
  if (t.type === 'chair') {
    // bấm vào ghế = bấm vào cái bàn bên cạnh
    const l = tileAt(r, x - 1, y), rr = tileAt(r, x + 1, y);
    t = l && l.type === 'table' ? l : rr && rr.type === 'table' ? rr : null;
    if (!t) return;
  }
  p.work = null;
  const ok = e => tell(p, { e });
  const say2 = msg => tell(p, { e: 'hint', msg });
  if (t.fire > 0) return say2('Đang cháy! Cầm bình cứu hỏa 🧯 bấm Xịt');

  switch (t.type) {
    case 'table': {
      const tb = r.tables[t.tb];
      const party = tb.party ? partyById(r, tb.party) : null;
      if (h && h.k === 'plate' && h.c.length) return deliver(r, p, tb, party);
      if (party && party.st === 'order') return takeOrder(r, party, p);
      if (tb.dirty && !party) {
        if (!h) { p.holding = { k: 'dirty', n: tb.dirty }; tb.dirty = 0; return ok('pick'); }
        if (h.k === 'dirty') { h.n += tb.dirty; tb.dirty = 0; return ok('pick'); }
        return say2('Bỏ đồ trên tay xuống rồi dọn bàn');
      }
      if (!party) return say2(`Bàn ${tb.num} đang trống`);
      if (party.st === 'reading' || party.st === 'seating') return say2('Khách đang xem menu… chờ giơ tay 🙋');
      if (party.st === 'wait') return say2(`Bàn ${tb.num} đang chờ: ${party.left.map(d => RECIPES[d].icon).join(' ')}`);
      if (party.st === 'eat') return say2('Khách đang ăn 😋');
      return;
    }
    case 'counter': case 'pass': case 'board': case 'crate': {
      if (!h) {
        if (t.item) { p.holding = t.item; t.item = null; return ok('pick'); }
        if (t.type === 'crate') { p.holding = { k: 'ing', t: t.ing, s: 'raw', p: 0 }; return ok('pick'); }
        return;
      }
      if (!t.item) {
        if (t.type === 'board' && h.k !== 'ing') return say2('Thớt chỉ để nguyên liệu thôi');
        t.item = h; p.holding = null; return ok('drop');
      }
      if (h.k === 'plate' && t.item.k === 'ing') {
        if (addToPlate(h, plateComp(t.item))) { t.item = null; return ok('drop'); }
        return say2(whyNot(t.item));
      }
      if (h.k === 'ing' && t.item.k === 'plate') {
        if (addToPlate(t.item, plateComp(h))) { p.holding = null; return ok('drop'); }
        return say2(whyNot(h));
      }
      if (h.k === 'dirty' && t.item.k === 'dirty') { t.item.n += h.n; p.holding = null; return ok('drop'); }
      return say2('Chỗ này có đồ rồi');
    }
    case 'stove': {
      const c = t.item;
      if (!h) {
        if (c.burnt) { clearCont(c); return ok('trash'); }
        if (contDish(c)) return say2('Chín rồi! Cầm đĩa tới múc 🍽️');
        return say2(c.k === 'pot' ? 'Bỏ 3 cà chua HOẶC 3 hành đã thái vào nồi' : 'Bỏ thịt đã thái vào chảo');
      }
      if (h.k === 'ing') {
        if (h.s === 'raw') return say2('Phải thái trước đã! 🔪');
        if (contAccepts(c, h)) {
          c.c.push(h.t); p.holding = null;
          if (isFull(c)) { c.p = 0; c.fast = p.role === 'cook'; }
          return ok('drop');
        }
        if (c.burnt) return say2('Khét rồi! Tay không bấm Cầm để đổ đi');
        return say2(c.k === 'pot' ? 'Nồi chỉ nấu súp: 3 cà chua hoặc 3 hành' : 'Chảo chỉ áp chảo thịt 🥩');
      }
      if (h.k === 'plate') {
        const d = contDish(c);
        if (!d) return say2(c.burnt ? 'Khét rồi! Tay không bấm Cầm để đổ đi' : 'Chưa chín!');
        if (addToPlate(h, d)) { clearCont(c); return ok('pick'); }
        return say2(d === 'meat' ? 'Đĩa này không thêm thịt được' : 'Súp cần một cái đĩa trống');
      }
      return;
    }
    case 'sink':
      if (h && h.k === 'dirty') { t.n += h.n; p.holding = null; return ok('drop'); }
      if (!h && t.n) return say2('Bấm nút Rửa 🧽');
      if (h) say2('Chỉ bỏ đĩa bẩn vào bồn');
      return;
    case 'rack':
      if (!h && t.n > 0) { t.n--; p.holding = newPlate(); return ok('pick'); }
      if (h && h.k === 'plate' && !h.c.length) { t.n++; p.holding = null; return ok('drop'); }
      return;
    case 'trash':
      if (!h) return;
      if (h.k === 'ing') { p.holding = null; return ok('trash'); }
      if (h.k === 'plate' && h.c.length) { h.c = []; return ok('trash'); }
      return say2('Không vứt cái này được');
  }
}

function startWork(r, p, x, y) {
  const t = tileAt(r, x, y);
  if (!t || Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) > REACH) return;
  const h = p.holding;
  if (h && h.k === 'ext') {
    if (t.fire > 0) { p.work = { x, y, fx: p.x, fy: p.y }; return; }
    return tell(p, { e: 'hint', msg: 'Chỗ này đâu có cháy 🧯' });
  }
  if (t.fire > 0) return tell(p, { e: 'hint', msg: 'Cần bình cứu hỏa 🧯 (mua ở 🛒)' });
  const can = (t.type === 'board' && t.item && t.item.k === 'ing' && t.item.s === 'raw') || (t.type === 'sink' && t.n > 0);
  if (!can) return tell(p, { e: 'hint', msg: t.type === 'board' && t.item && t.item.s === 'chopped' ? 'Thái xong rồi!' : 'Không có gì để thái / rửa ở đây' });
  if (h) return tell(p, { e: 'hint', msg: 'Bỏ đồ trên tay xuống trước đã' });
  p.work = { x, y, fx: p.x, fy: p.y };
}

/* ===================== FIRE / RATS / EVENTS ===================== */
const FLAMMABLE = new Set(['counter', 'pass', 'board', 'crate', 'stove', 'rack']);

function ignite(r, i) {
  const t = r.tiles[i];
  if (!t || !FLAMMABLE.has(t.type) || t.fire > 0) return false;
  t.fire = 0.01; t.ext = 0; t.spread = Math.max(8, 15 - r.level * 1.5);
  const it = t.item;
  if (it) {
    if (it.k === 'ing') t.item = null;
    else if (it.k === 'plate') it.c = [];
    else if (it.k === 'pot' || it.k === 'pan') clearCont(it);
  }
  emit(r, { e: 'fire', i });
  return true;
}

function spawnRats(r, n) {
  for (let k = 0; k < n && r.rats.length < 8; k++) {
    const h = pick(HOLES);
    r.rats.push({ id: ++entSeq, x: h[0], y: h[1], a: 0, hp: r.level >= 3 ? 2 : 1, path: [], target: null, eatT: 0, poopT: rand(4, 8), think: 0 });
  }
}

const hasFood = t => t && !t.fire && ['counter', 'board', 'crate'].includes(t.type) && t.item && (t.item.k === 'ing' || (t.item.k === 'plate' && t.item.c.length));

function tickRats(r, dt) {
  const speed = 2 + Math.min(1.2, r.level * 0.2);
  for (const rat of r.rats) {
    rat.poopT -= dt;
    if (rat.poopT <= 0) {
      rat.poopT = rand(6, 10);
      const c = cellOf(rat.x, rat.y);
      if (r.dirt.size < MAX_DIRT && isFloor(c % MW, (c / MW) | 0)) r.dirt.add(c);
    }
    if (rat.path.length) { walk(rat, speed, dt); continue; }
    if (rat.target != null) {
      const t = r.tiles[rat.target];
      if (!hasFood(t)) { rat.target = null; continue; }
      rat.eatT += dt;
      const [tx, ty] = cellCenter(rat.target);
      rat.a = Math.atan2(tx - rat.x, ty - rat.y);
      if (rat.eatT >= 2.5) {
        if (t.item.k === 'ing') t.item = null; else t.item.c = [];
        rat.target = null; rat.eatT = 0;
        emit(r, { e: 'ratEat', i: r.tiles.indexOf(t) });
      }
      continue;
    }
    rat.think -= dt;
    if (rat.think > 0) continue;
    rat.think = rand(0.3, 1.2);
    const foods = [];
    r.tiles.forEach((t, i) => { if (hasFood(t)) foods.push(i); });
    if (foods.length && Math.random() < 0.75) {
      const fi = pick(foods), goals = adjWalk(fi);
      const p = goals.size ? pathTo(rat, goals) : null;
      if (p) { rat.path = p; rat.target = fi; rat.eatT = 0; continue; }
    }
    rat.path = pathTo(rat, pick(floorCells)) || [];
  }
}

function tickCat(r, dt) {
  const cat = r.staff.cat;
  if (!cat.on) return;
  cat.think -= dt;
  let prey = null, bd = 1e9;
  for (const rat of r.rats) { const d = Math.hypot(rat.x - cat.x, rat.y - cat.y); if (d < bd) { bd = d; prey = rat; } }
  if (prey && bd < 0.5) {
    r.rats.splice(r.rats.indexOf(prey), 1);
    emit(r, { e: 'ratDie', x: prey.x, y: prey.y, cat: 1 });
    cat.path = [];
    return;
  }
  if (cat.think <= 0) {
    cat.think = 0.4;
    cat.path = pathTo(cat, prey ? cellOf(prey.x, prey.y) : cellOf(CAT_HOME[0], CAT_HOME[1])) || [];
  }
  if (prey && !cat.path.length) {
    const dx = prey.x - cat.x, dy = prey.y - cat.y, d = Math.hypot(dx, dy) || 1;
    cat.x += (dx / d) * 3.6 * dt; cat.y += (dy / d) * 3.6 * dt; cat.a = Math.atan2(dx, dy);
  } else walk(cat, prey ? 3.6 : 1.5, dt);
}

function tickInspector(r, dt) {
  const ins = r.insp;
  if (!ins) return;
  ins.left -= dt;
  if (walk(ins, 1.3, dt)) ins.path = pathTo(ins, pick(floorCells)) || [];
  if (ins.left > 0) return;
  r.insp = null;
  if (r.up.license) {
    r.up.license = false;
    r.money += 60; r.earned += 60; r.rep = Math.min(100, r.rep + 10);
    return emit(r, { e: 'inspResult', pass: true, license: true, v: [] });
  }
  const v = [];
  if (r.rats.length) v.push(`🐀 Có ${r.rats.length} con chuột`);
  if (r.tiles.some(t => t.fire > 0)) v.push('🔥 Bếp đang cháy');
  if (r.dirt.size >= 3) v.push(`💩 Sàn bẩn (${r.dirt.size} chỗ)`);
  if (r.tiles.some(t => t.type === 'stove' && t.item.burnt)) v.push('⚫ Nồi chảo khét');
  const dirtyTables = r.tables.filter(t => t.dirty).length;
  if (dirtyTables >= 2) v.push(`🍽️ ${dirtyTables} bàn ăn chưa dọn`);
  let dirty = 0;
  for (const t of r.tiles) { if (t.type === 'sink') dirty += t.n; if (t.item && t.item.k === 'dirty') dirty += t.item.n; }
  for (const p of r.players.values()) if (p.holding && p.holding.k === 'dirty') dirty += p.holding.n;
  if (dirty >= 5) v.push(`🧽 Đĩa bẩn tồn đọng (${dirty})`);
  if (!v.length) { r.money += 60; r.earned += 60; r.rep = Math.min(100, r.rep + 10); }
  else { r.money = Math.max(0, r.money - 25 * v.length); r.rep -= 8 * v.length; }
  emit(r, { e: 'inspResult', pass: !v.length, v, fine: 25 * v.length });
}

function startEvent(r, k) {
  r.eventsSeen++;
  const lvl = r.level;
  switch (k) {
    case 'rats': {
      if (r.ratBlock > 0) return emit(r, { e: 'event', k, blocked: true });
      const n = r.eventCount === 0 ? 1 : 1 + Math.floor(lvl / 2);
      spawnRats(r, n);
      return emit(r, { e: 'event', k, n, first: r.eventCount === 0 });
    }
    case 'rush':
      r.rush = 40;
      r.nextCust = Math.min(r.nextCust, 2);
      return emit(r, { e: 'event', k, dur: 40 });
    case 'vip':
      spawnParty(r, true);
      return emit(r, { e: 'event', k });
    case 'fire': {
      if (r.up.sprinkler && Math.random() < 0.3) return emit(r, { e: 'event', k, blocked: true });
      const stoves = [];
      r.tiles.forEach((t, i) => { if (t.type === 'stove' && !t.fire) stoves.push(i); });
      const n = lvl >= 4 ? 2 : 1;
      for (let j = 0; j < n && stoves.length; j++) ignite(r, stoves.splice(Math.random() * stoves.length | 0, 1)[0]);
      return emit(r, { e: 'event', k, n });
    }
    case 'outage':
      if (r.up.gen) return emit(r, { e: 'event', k, blocked: true });
      r.outage = 14 + lvl * 3;
      return emit(r, { e: 'event', k, dur: r.outage });
    case 'insp': {
      const h = pick(SPAWNS);
      r.insp = { x: h[0], y: h[1], a: 0, left: 35, path: [] };
      return emit(r, { e: 'event', k, dur: 35 });
    }
  }
}

function tickEvents(r) {
  if (r.elapsed < r.nextEvent) return;
  const el = r.elapsed;
  const pool = [];
  if (r.rats.length < 4) pool.push('rats', 'rats');
  if (r.rush <= 0) pool.push('rush');
  if (el >= 160) pool.push('vip', 'vip');
  if (el >= 240) { pool.push('fire'); if (r.outage <= 0) pool.push('outage'); }
  if (el >= 330 && !r.insp) pool.push('insp', 'insp');
  let k = pick(pool);
  if (r.eventCount === 0) k = 'rats';                              // sự kiện đầu luôn nhẹ: 1 con chuột
  else if (r.eventCount === 3 && el >= 240) k = 'fire';
  else if (!r.seenInsp && el >= 330 && !r.insp) k = 'insp';
  if (k === 'insp') r.seenInsp = true;
  if (k) startEvent(r, k);
  r.eventCount++;
  r.nextEvent = el + Math.max(35, 80 - r.level * 8) + rand(0, 25);
}

/* ===================== STAFF ===================== */
function sinkNear(r) {
  let best = null;
  r.tiles.forEach((t, i) => { if (t.type === 'sink' && !t.fire && (!best || t.n < r.tiles[best].n)) best = i; });
  return best;
}

// bàn đang chờ món `key` mà chưa có ai đang bưng tới
function tableWanting(r, key, exceptReserved) {
  return r.tables.find(tb => {
    const pt = tb.party && partyById(r, tb.party);
    if (!pt || pt.st !== 'wait') return false;
    const need = pt.left.filter(d => d === key).length;
    const coming = exceptReserved ? 0 : (r.staff.waiter.plate && r.staff.waiter.serveT === r.tables.indexOf(tb) && recipeOf(r.staff.waiter.plate.c) === key ? 1 : 0);
    return need > coming;
  });
}
const passTiles = r => r.tiles.map((t, i) => (t.type === 'pass' ? i : -1)).filter(i => i >= 0);

function tickWaiter(r, dt) {
  const w = r.staff.waiter;
  if (!w.on) return;
  if (w.pause > 0) { w.pause -= dt; return; }
  if (w.path.length) { walk(w, 2.6, dt); return; }
  if (w.task) { waiterArrive(r, w); w.task = null; w.think = 0; return; }
  w.think -= dt;
  if (w.think > 0) return;
  w.think = 0.3;
  waiterPlan(r, w);
}

function waiterGo(r, w, task, goals, target) {
  const p = pathTo(w, goals);
  if (!p) return false;
  w.path = p; w.task = task; w.target = target;
  return true;
}

function waiterArrive(r, w) {
  switch (w.task) {
    case 'dirty': {
      const t = r.tables[w.target];
      if (t.dirty && !t.party) { w.carry += t.dirty; t.dirty = 0; }
      t.claim = null;
      break;
    }
    case 'sink': {
      const s = r.tiles[w.target];
      if (!s.fire) { s.n += w.carry; w.carry = 0; }
      break;
    }
    case 'order': {
      const t = r.tables[w.target];
      t.oclaim = null;
      const party = t.party ? partyById(r, t.party) : null;
      if (party && party.st === 'order') { takeOrder(r, party, null, 'waiter'); w.pause = 0.8; }
      break;
    }
    case 'pickup': {
      const tile = r.tiles[w.target];
      if (!tile.fire && tile.item && tile.item.k === 'plate' && recipeOf(tile.item.c) === w.dish) {
        w.plate = tile.item; tile.item = null;
        emit(r, { e: 'pickup', i: w.target });
      }
      break;
    }
    case 'serve': {
      const t = r.tables[w.serveT];
      const party = t.party ? partyById(r, t.party) : null;
      const key = w.plate && recipeOf(w.plate.c);
      if (key && party && party.st === 'wait' && party.left.includes(key)) {
        w.plate = null;
        serveDish(r, t, party, key, 0);
        w.pause = 0.4;
      }
      break;
    }
    case 'putback': {
      const tile = r.tiles[w.target];
      if (w.plate && !tile.item && !tile.fire) { tile.item = w.plate; w.plate = null; }
      break;
    }
  }
}

function waiterPlan(r, w) {
  // 1. đang cầm món: bưng tới bàn cần nó, không bàn nào cần thì để lại quầy
  if (w.plate) {
    const key = recipeOf(w.plate.c);
    const t = tableWanting(r, key, true);
    if (t) { w.serveT = r.tables.indexOf(t); if (waiterGo(r, w, 'serve', adjWalk(t.i), w.serveT)) return; }
    const free = passTiles(r).filter(i => !r.tiles[i].item && !r.tiles[i].fire);
    if (free.length && waiterGo(r, w, 'putback', new Set(free.flatMap(i => [...adjWalk(i)])), free[0])) {
      // chọn ô quầy trống gần đích nhất khi tới nơi
      const end = w.path[w.path.length - 1];
      w.target = free.find(i => adjWalk(i).has(end)) ?? free[0];
      return;
    }
    w.plate.c = []; findTile(r, 'rack').n++; w.plate = null;   // hết chỗ: trả đĩa về kệ
    return;
  }
  // 2. đang ôm đĩa bẩn: mang về bồn trước đã
  if (w.carry) {
    const si = sinkNear(r);
    if (si != null && waiterGo(r, w, 'sink', adjWalk(si), si)) return;
  }
  // 3. có món ở quầy ra món khớp với bàn đang chờ → đi lấy
  for (const i of passTiles(r)) {
    const it = r.tiles[i].item;
    if (r.tiles[i].fire || !it || it.k !== 'plate' || !it.c.length) continue;
    const key = recipeOf(it.c);
    const t = key && tableWanting(r, key, false);
    if (t && waiterGo(r, w, 'pickup', adjWalk(i), i)) { w.dish = key; w.serveT = r.tables.indexOf(t); return; }
  }
  // 4. bàn đang giơ tay → ra ghi món
  const ot = r.tables.find(tb => { const pt = tb.party && partyById(r, tb.party); return pt && pt.st === 'order' && tb.oclaim == null; });
  if (ot && waiterGo(r, w, 'order', adjWalk(ot.i), r.tables.indexOf(ot))) { ot.oclaim = 'waiter'; return; }
  // 5. dọn bàn bẩn
  const dt = r.tables.find(tb => tb.dirty && !tb.party && tb.claim == null);
  if (dt && waiterGo(r, w, 'dirty', adjWalk(dt.i), r.tables.indexOf(dt))) { dt.claim = 'waiter'; return; }
  // 6. rảnh thì đứng chờ cạnh quầy ra món
  if (Math.hypot(w.x - WAITER_HOME[0], w.y - WAITER_HOME[1]) > 0.3) w.path = pathTo(w, cellOf(WAITER_HOME[0], WAITER_HOME[1])) || [];
}

function tickHost(r, dt) {
  const h = r.staff.host;
  if (!h.on) return;
  if (h.path.length) { walk(h, 2.4, dt); return; }
  if (h.task) {
    const t = r.tables[h.target];
    t.oclaim = null;
    const party = t.party ? partyById(r, t.party) : null;
    if (party && party.st === 'order') takeOrder(r, party, null, 'host');
    h.task = null;
  }
  h.think -= dt;
  if (h.think > 0) return;
  h.think = 0.5;
  const t = r.tables.find(tb => { const pt = tb.party && partyById(r, tb.party); return pt && pt.st === 'order' && tb.oclaim == null; });
  if (t) { h.path = pathTo(h, adjWalk(t.i)) || []; h.task = 'order'; h.target = r.tables.indexOf(t); t.oclaim = 'host'; return; }
  if (Math.hypot(h.x - HOST_HOME[0], h.y - HOST_HOME[1]) > 0.3) h.path = pathTo(h, cellOf(HOST_HOME[0], HOST_HOME[1])) || [];
}

function dropWaiterStuff(r) {
  const w = r.staff.waiter;
  if (w.carry) { const si = sinkNear(r); if (si != null) r.tiles[si].n += w.carry; w.carry = 0; }
  if (w.plate) {
    const free = passTiles(r).find(i => !r.tiles[i].item);
    if (free != null) r.tiles[free].item = w.plate; else findTile(r, 'rack').n++;
    w.plate = null;
  }
  for (const t of r.tables) { if (t.claim === 'waiter') t.claim = null; if (t.oclaim === 'waiter') t.oclaim = null; }
  w.task = null; w.path = [];
}

function tickStaff(r, dt) {
  const S = r.staff;
  if (S.wash.on) {
    const src = r.tiles.find(t => t.type === 'sink' && t.n > 0 && !t.fire);
    S.wash.busy = !!src;
    if (src) {
      S.wash.prog += dt / 3.5;
      if (S.wash.prog >= 1) { S.wash.prog = 0; src.n--; findTile(r, 'rack').n++; }
    }
  }
  if (S.chop.on) {
    const b = r.tiles.find(t => t.type === 'board' && !t.fire && t.item && t.item.k === 'ing' && t.item.s === 'raw');
    S.chop.busy = !!b;
    if (b) {
      b.item.p += dt / (CHOP_TIME * 2);
      if (b.item.p >= 1) { b.item.s = 'chopped'; b.item.p = 0; }
    }
  }
  if (S.prep.on) {
    S.prep.busy = Math.max(0, S.prep.busy - dt);
    S.prep.t -= dt;
    if (S.prep.t <= 0) {
      S.prep.t = 9;
      const slot = PREP_TILES.find(i => !r.tiles[i].item && !r.tiles[i].fire);
      const need = [];
      for (const o of r.orders) {
        if (o.r === 'salad') need.push('tomato', 'lettuce');
        if (o.r === 'soupT') need.push('tomato', 'tomato');
        if (o.r === 'soupO') need.push('onion', 'onion');
        if (o.r === 'banhmi') need.push('bread', 'lettuce', 'meat');
      }
      if (slot != null && need.length) { r.tiles[slot].item = { k: 'ing', t: pick(need), s: 'chopped', p: 0 }; S.prep.busy = 1.2; }
    }
  }
  tickCat(r, dt);
  tickWaiter(r, dt);
  tickHost(r, dt);

  r.wageT += dt;
  if (r.wageT >= 60) {
    r.wageT = 0;
    const hired = Object.keys(S).filter(k => S[k].on).sort((a, b) => SHOP[b].wage - SHOP[a].wage);
    let total = hired.reduce((s, k) => s + SHOP[k].wage, 0);
    const quit = [];
    while (total > r.money && hired.length) {
      const k = hired.shift();
      S[k].on = false; total -= SHOP[k].wage; quit.push(k);
      if (k === 'waiter') dropWaiterStuff(r);
    }
    r.money -= total;
    if (total || quit.length) emit(r, { e: 'wage', total, quit });
  }
}

/* ===================== MAIN TICK ===================== */
function tick(r, dt) {
  if (r.cd > 0) {
    r.cd = Math.max(0, r.cd - dt);
    return broadcast(r, snapshot(r));
  }
  r.time -= dt; r.elapsed += dt;
  const lvl = 1 + Math.floor(r.elapsed / LEVEL_EVERY);
  if (lvl !== r.level) { r.level = lvl; emit(r, { e: 'level', lvl }); }
  r.rush = Math.max(0, r.rush - dt);
  r.ratBlock = Math.max(0, r.ratBlock - dt);
  if (r.outage > 0) { r.outage = Math.max(0, r.outage - dt); if (!r.outage) emit(r, { e: 'power' }); }

  // người chơi: thái / rửa / xịt lửa / lau sàn
  for (const p of r.players.values()) {
    if (p.holding && p.holding.k === 'mop' && r.dirt.delete(cellOf(p.x, p.y))) tell(p, { e: 'clean' });
    const w = p.work;
    if (!w) continue;
    const t = tileAt(r, w.x, w.y);
    if (!t || Math.hypot(p.x - w.fx, p.y - w.fy) > 0.45) { p.work = null; continue; }
    const h = p.holding;
    if (h && h.k === 'ext') {
      if (!t.fire) { p.work = null; continue; }
      t.ext += dt / 1.1;
      if (t.ext >= 1) {
        t.fire = 0; t.ext = 0; p.work = null; p.st.fx++;
        h.n--;
        emit(r, { e: 'extinguish', i: w.y * MW + w.x });
        if (h.n <= 0) { p.holding = null; tell(p, { e: 'hint', msg: 'Bình cứu hỏa hết rồi!' }); }
      }
      continue;
    }
    if (h || t.fire) { p.work = null; continue; }
    if (t.type === 'board' && t.item && t.item.k === 'ing' && t.item.s === 'raw') {
      t.item.p += dt / (CHOP_TIME / (p.role === 'chop' ? 2 : 1));
      if (t.item.p >= 1) { t.item.s = 'chopped'; t.item.p = 0; p.work = null; p.st.ch++; tell(p, { e: 'chopped' }); }
    } else if (t.type === 'sink' && t.n > 0) {
      t.prog += dt / (WASH_TIME / (p.role === 'wash' ? 2 : 1));
      if (t.prog >= 1) {
        t.prog = 0; t.n--; p.st.wa++;
        findTile(r, 'rack').n++;
        tell(p, { e: 'washed' });
        if (!t.n) p.work = null;
      }
    } else p.work = null;
  }

  // nấu (cúp điện thì bếp tắt)
  r.tiles.forEach((t, i) => {
    if (t.type !== 'stove' || t.fire) return;
    const c = t.item;
    if (c.burnt) {
      c.bt += dt;
      if (c.bt >= 8) ignite(r, i);          // để nồi khét lâu quá là bắt lửa
      return;
    }
    if (!isFull(c) || r.outage > 0) return;
    const { cook, burn } = COOK[c.k];
    const before = c.p;
    c.p += dt * (c.fast && c.p < cook ? 1.5 : 1) * (r.up.cooker ? 1.3 : 1);
    if (before < cook && c.p >= cook) emit(r, { e: 'cooked', i });
    if (c.p >= cook + burn) { c.burnt = true; c.bt = 0; emit(r, { e: 'burnt', i }); }
  });

  // lửa lan (giới hạn số ô cháy theo cấp)
  let fires = r.tiles.filter(t => t.fire > 0).length;
  const maxFires = 2 + r.level;
  r.tiles.forEach((t, i) => {
    if (!t.fire) return;
    t.fire += dt;
    if (r.up.sprinkler ? t.fire > 6 : t.fire > 45) { t.fire = 0; t.ext = 0; emit(r, { e: 'extinguish', i }); return; }
    if (r.up.sprinkler) return;
    t.spread -= dt;
    if (t.spread > 0) return;
    t.spread = Math.max(8, 15 - r.level * 1.5);
    if (fires >= maxFires) return;
    const x = i % MW, y = (i / MW) | 0, nb = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n2 = tileAt(r, x + dx, y + dy);
      if (n2 && FLAMMABLE.has(n2.type) && !n2.fire) nb.push((y + dy) * MW + x + dx);
    }
    if (nb.length && ignite(r, pick(nb))) fires++;
  });

  tickCustomers(r, dt);
  tickRats(r, dt);
  tickInspector(r, dt);
  tickStaff(r, dt);
  tickEvents(r);

  // uy tín tụt khi nhà hàng có chuột / cháy / bẩn
  r.rep -= dt * (r.rats.length * 0.12 + fires * 0.12 + r.dirt.size * 0.02);

  if (r.rep <= 0) { r.rep = 0; return endGame(r, 'rep'); }
  if (r.time <= 0) { r.time = 0; return endGame(r, 'time'); }
  broadcast(r, snapshot(r));
}

function snapshot(r) {
  const pl = [];
  for (const p of r.players.values()) {
    if (p.spawned) pl.push({ id: p.id, n: p.name, r: p.role, x: p.x, y: p.y, a: p.a, h: p.holding, w: p.work ? 1 : 0 });
  }
  const tl = [];
  r.tiles.forEach((t, i) => { if (t.item || t.n || t.prog || t.fire) tl.push([i, t.item, t.n, t.prog, t.fire ? 1 : 0, t.ext]); });
  const S = r.staff;
  return {
    t: 's', time: r.time, cd: r.cd, money: r.money, earned: r.earned, rep: Math.ceil(r.rep), lvl: r.level,
    orders: r.orders.map(o => ({ id: o.id, r: o.r, t: o.t, left: o.left, max: o.max, vip: o.vip })),
    pl, tl,
    cu: r.customers.map(c => ({ id: c.id, x: c.x, y: c.y, a: c.a, s: c.sit ? 1 : 0, c: c.col, v: partyById(r, c.party)?.vip ? 1 : 0, m: c.mood })),
    tb: r.tables.map(t => {
      const pt = t.party ? partyById(r, t.party) : null;
      return { i: t.i, num: t.num, st: pt ? pt.st : t.dirty ? 'dirty' : 'free', f: t.food, d: t.dirty, l: pt ? pt.left : [], p: pt && pt.patMax ? pt.pat / pt.patMax : 0, v: pt ? pt.vip : false };
    }),
    q: r.parties.filter(p => p.st === 'queue').map(p => ({ c: p.members[0], p: p.pat / p.patMax })),
    rats: r.rats.map(x => ({ id: x.id, x: x.x, y: x.y, a: x.a })),
    dirt: [...r.dirt],
    staff: { wash: S.wash.on ? (S.wash.busy ? 2 : 1) : 0, chop: S.chop.on ? (S.chop.busy ? 2 : 1) : 0, prep: S.prep.on ? (S.prep.busy > 0 ? 2 : 1) : 0, waiter: S.waiter.on ? 1 : 0, host: S.host.on ? 1 : 0 },
    wk: {
      waiter: S.waiter.on ? { x: S.waiter.x, y: S.waiter.y, a: S.waiter.a, h: S.waiter.plate || (S.waiter.carry ? { k: 'dirty', n: S.waiter.carry } : null) } : null,
      host: S.host.on ? { x: S.host.x, y: S.host.y, a: S.host.a } : null,
    },
    cat: S.cat.on ? { x: S.cat.x, y: S.cat.y, a: S.cat.a } : null,
    insp: r.insp ? { x: r.insp.x, y: r.insp.y, a: r.insp.a, left: r.insp.left } : null,
    out: r.outage, rush: r.rush, block: r.ratBlock, up: r.up,
  };
}

function endGame(r, reason) {
  r.state = 'ended';
  broadcast(r, snapshot(r));
  broadcast(r, {
    t: 'end', reason, earned: r.earned, served: r.served, failed: r.failed, elapsed: r.elapsed, level: r.level, events: r.eventsSeen,
    stars: STARS.filter(s => r.earned >= s).length, thresholds: STARS,
    players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, role: p.role, ...(p.st || {}) })),
  });
  broadcast(r, lobbyMsg(r));
}

function startGame(r) {
  resetGame(r);
  r.state = 'playing';
  broadcast(r, { t: 'start' });
  broadcast(r, lobbyMsg(r));
}

// tìm ô bàn bếp trống gần một điểm để đặt đồ vừa mua
function emptyCounterNear(r, x, y) {
  let best = -1, bd = 1e9;
  r.tiles.forEach((t, i) => {
    if (t.type !== 'counter' || t.item || t.fire || PREP_TILES.includes(i)) return;
    const d = Math.hypot((i % MW) + 0.5 - x, ((i / MW) | 0) + 0.5 - y);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

function buy(r, p, k) {
  const it = SHOP[k];
  if (!it) return;
  const say2 = msg => tell(p, { e: 'hint', msg });
  if (r.money < it.price) return say2('Không đủ tiền 💸');
  if (it.cat === 'staff' && r.staff[k].on) return say2('Đã thuê rồi');
  if (it.cat === 'up' && r.up[k]) return say2('Đã có rồi');
  switch (k) {
    case 'ext': case 'mop': {
      const at = k === 'ext' ? [11.5, 0.5] : [8, 8.5];
      const i = emptyCounterNear(r, at[0], at[1]);
      if (i < 0) return say2('Hết bàn trống để đặt đồ!');
      r.tiles[i].item = k === 'ext' ? { k: 'ext', n: 4 } : { k: 'mop' };
      break;
    }
    case 'plate':
      if (r.plates >= MAX_PLATES) return say2('Đủ đĩa rồi (tối đa 10)');
      r.plates++; findTile(r, 'rack').n++;
      break;
    case 'poison':
      for (const rat of r.rats) emit(r, { e: 'ratDie', x: rat.x, y: rat.y, poison: 1 });
      r.rats = []; r.ratBlock = 45;
      break;
    case 'time': r.time += 30; break;
    case 'license':
      if (r.up.license) return say2('Đang có giấy rồi');
      r.up.license = true;
      break;
    default:
      if (it.cat === 'staff') {
        const s = r.staff[k];
        s.on = true;
        const home = { cat: CAT_HOME, waiter: WAITER_HOME, host: HOST_HOME }[k];
        if (home) Object.assign(s, { x: home[0], y: home[1], path: [], task: null, pause: 0 });
      } else r.up[k] = true;
  }
  r.money -= it.price;
  emit(r, { e: 'buy', k, id: p.id });
}

function leave(r, p) {
  r.players.delete(p.id);
  // đừng để mất đĩa / dụng cụ khi ai đó thoát giữa chừng
  if (r.state === 'playing' && p.holding) {
    if (p.holding.k === 'plate') findTile(r, 'rack').n++;
    else if (p.holding.k === 'dirty') { const si = sinkNear(r); if (si != null) r.tiles[si].n += p.holding.n; }
    else if (p.holding.k === 'ext' || p.holding.k === 'mop') {
      const i = emptyCounterNear(r, p.x, p.y);
      if (i >= 0) r.tiles[i].item = p.holding;
    }
  }
  if (!r.players.size) { rooms.delete(r.code); return; }
  if (r.host === p.id) r.host = r.players.keys().next().value;
  broadcast(r, lobbyMsg(r));
}

function handle(r, p, m) {
  const live = r.state === 'playing' && r.cd <= 0;
  switch (m.t) {
    case 'role':
      if (ROLES[m.role] && r.state !== 'playing') { p.role = m.role; broadcast(r, lobbyMsg(r)); }
      break;
    case 'start':
      if (p.id === r.host && r.state !== 'playing') startGame(r);
      break;
    case 'lobby':
      if (p.id === r.host && r.state === 'ended') { r.state = 'lobby'; broadcast(r, lobbyMsg(r)); }
      break;
    case 'p':
      if (r.state === 'playing' && Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.a)) {
        p.x = clamp(m.x, 0, MW); p.y = clamp(m.y, 0, MH); p.a = m.a;
      }
      break;
    case 'act': if (live) interact(r, p, m.x | 0, m.y | 0); break;
    case 'work': if (live) startWork(r, p, m.x | 0, m.y | 0); break;
    case 'buy': if (live) buy(r, p, String(m.k)); break;
    case 'shout': {
      const i = m.i | 0, now = Date.now();
      if (i >= 0 && i < 8 && now - (p.lastShout || 0) > 600) { p.lastShout = now; emit(r, { e: 'shout', id: p.id, i }); }
      break;
    }
  }
}

/* ===================== SOCKETS ===================== */
const wss = new WebSocketServer({ server, maxPayload: 4096 });

wss.on('connection', ws => {
  let me = null, room = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', data => {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (me) return handle(room, me, m);
    if (m.t !== 'create' && m.t !== 'join') return;

    let r;
    if (m.t === 'create') r = createRoom();
    else {
      const code = String(m.room || '').toUpperCase().trim().slice(0, 8);
      r = rooms.get(code);
      if (!r) return send(ws, { t: 'err', msg: `Không thấy phòng "${code}" 😢` });
      if (r.players.size >= MAX_PLAYERS) return send(ws, { t: 'err', msg: 'Phòng đầy rồi (tối đa 8 người)' });
    }
    room = r;
    me = { id: ++pidSeq, ws, name: cleanName(m.name), role: freeRole(r), x: 0, y: 0, a: 0, holding: null, work: null, spawned: false, st: { sv: 0, od: 0, ch: 0, wa: 0, rk: 0, fx: 0 } };
    if (!me.name) me.name = 'Bếp ' + me.id;
    r.players.set(me.id, me);
    if (!r.host) r.host = me.id;
    send(ws, { t: 'welcome', id: me.id, room: r.code, map: MAP, recipes: RECIPES, roles: ROLES, shop: SHOP, events: EVENTS, cook: COOK, round: ROUND_TIME, prep: PREP_TILES });
    if (r.state === 'playing') { spawn(me, r.players.size - 1); send(ws, { t: 'start' }); }
    broadcast(r, lobbyMsg(r));
  });

  ws.on('close', () => { if (me) leave(room, me); });
});

// dọn kết nối chết
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

// vòng lặp game 20 tick/giây
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.2, (now - lastTick) / 1000) * SPEED;
  lastTick = now;
  for (const r of rooms.values()) if (r.state === 'playing') tick(r, dt);
}, 50);

server.listen(PORT, () => {
  console.log(`\n🍳 Bếp Loạn đang chạy!`);
  console.log(`   Máy này:      http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`   Cùng wifi:    http://${a.address}:${PORT}`);
    }
  }
  console.log('');
});
