// Chạy: node --test test/code.test.mjs
// Mô phỏng dịch vụ Google bằng đối tượng giả. Không thay thế việc kiểm tra trên Trang tính thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const CODE = fs.readFileSync(path.join(dir, '..', 'apps-script', 'Code.gs'), 'utf8');
const HEADERS = ['id', 'createdAt', 'name', 'phone', 'email', 'workshop', 'preferredContact', 'message', 'status', 'note', 'contactLog', 'confirmedAt', 'updatedAt'];
const OWNER = 'owner@example.com';

/** setValues phân tích dấu '=' ngay cả trong ô có định dạng văn bản. */
function makeSheet(rows, { header = HEADERS } = {}) {
  const cells = new Map();
  const key = (r, c) => `${r}:${c}`;
  const put = (r, c, v) => cells.set(key(r, c), { v, fmt: '', f: '' });
  header.forEach((h, i) => put(1, i + 1, h));
  rows.forEach((row, ri) => row.forEach((v, ci) => put(ri + 2, ci + 1, v)));
  const get = (r, c) => cells.get(key(r, c)) || { v: '', fmt: '', f: '' };
  const show = (cell) => (cell.v instanceof Date ? `D:${cell.v.toISOString()}` : cell.v === null || cell.v === undefined ? '' : String(cell.v));
  const writes = [];
  let lastRow = rows.length + 1;
  const sheet = {
    getLastRow: () => lastRow,
    getLastColumn: () => header.length,
    getRange(r, c, nr = 1, nc = 1) {
      const grid = (fn) => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => fn(get(r + i, c + j))));
      return {
        getValues: () => grid((x) => x.v),
        getDisplayValues: () => grid(show),
        getFormulas: () => grid((x) => x.f),
        setNumberFormat(fmt) { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { const x = get(r + i, c + j); cells.set(key(r + i, c + j), { ...x, fmt }); } },
        setValues(vals) {
          writes.push({ r, c, nr, nc });
          vals.forEach((rowVals, i) => rowVals.forEach((v, j) => {
            const x = get(r + i, c + j);
            const isFormula = typeof v === 'string' && v.startsWith('=');
            const isEscaped = typeof v === 'string' && v.startsWith("'");
            cells.set(key(r + i, c + j), { fmt: x.fmt, f: isFormula ? v : '', v: isFormula ? '#EVAL' : isEscaped ? v.slice(1) : v });
          }));
          lastRow = Math.max(lastRow, r + nr - 1);
        },
      };
    },
  };
  const snapshot = () => JSON.stringify([...cells.entries()]);
  return { sheet, writes, snapshot, cells, get, setLastRow: (n) => { lastRow = n; } };
}

function load({ sheetState, email = OWNER, props, lockFails = false, mutateOnWrite } = {}) {
  const properties = props || { SPREADSHEET_ID: 'sheet-1', OWNER_EMAIL: OWNER };
  const logs = [];
  const ctx = {
    console: { error: (m) => logs.push(m), log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in properties ? properties[k] : null) }) },
    Session: { getActiveUser: () => ({ getEmail: () => email }) },
    LockService: { getScriptLock: () => ({ waitLock() { if (lockFails) throw new Error('timeout'); }, releaseLock() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => (n === 'DangKy' ? sheetState.sheet : null) }), flush() {} },
    HtmlService: { createHtmlOutput: (h) => ({ html: h }), createHtmlOutputFromFile: (f) => ({ file: f, setTitle() { return this; }, addMetaTag() { return this; } }) },
    Utilities: {
      formatDate(d, tz, fmt) {
        const p = new Date(d.getTime() + 7 * 3600000).toISOString();
        const [date, time] = p.split('T');
        const hms = time.slice(0, 8);
        if (fmt === 'yyyy-MM-dd HH:mm') return `${date} ${hms.slice(0, 5)}`;
        if (fmt === "yyyy-MM-dd'T'HH:mm:ssXXX") return `${date}T${hms}+07:00`;
        throw new Error('format không hỗ trợ: ' + fmt);
      },
    },
  };
  if (mutateOnWrite) {
    const orig = sheetState.sheet.getRange;
    sheetState.sheet.getRange = (...a) => { const r = orig(...a); const sv = r.setValues; r.setValues = (v) => { mutateOnWrite(); sv(v); }; return r; };
  }
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  return { ctx, logs };
}

const reg = (n, over = {}) => ({
  id: `DK000${n}`, createdAt: '2026-11-14T20:41:53+07:00', name: `Học viên ${n}`, phone: `090000000${n}`, email: '', workshop: 'F2',
  preferredContact: 'zalo', message: '', status: 'new', note: '', contactLog: '', confirmedAt: '', updatedAt: '', ...over,
});
const toRow = (o) => HEADERS.map((h) => o[h]);
const fixture = () => makeSheet([toRow(reg(1, { name: '[KIỂM TRA HỆ THỐNG] F2 01' })), toRow(reg(2)), toRow(reg(3, { phone: '0912778004' }))]);

test('từ chối khi người dùng không phải chủ lớp', () => {
  for (const email of ['other@example.com', '', 'OWNER@example.com.evil.com']) {
    const s = fixture();
    const before = s.snapshot();
    const { ctx } = load({ sheetState: s, email });
    assert.deepEqual({ ...ctx.apiLoad() }, { ok: false, error: 'forbidden' });
    assert.equal(ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: '', status: 'contacted' }).error, 'forbidden');
    assert.equal(s.snapshot(), before);
  }
});

test('từ chối khi chưa cấu hình OWNER_EMAIL, kể cả khi email rỗng', () => {
  const s = fixture();
  const { ctx } = load({ sheetState: s, email: '', props: { SPREADSHEET_ID: 'x' } });
  assert.equal(ctx.apiLoad().error, 'forbidden');
});

test('doGet chỉ trả trang giao diện cho chủ lớp', () => {
  const s = fixture();
  assert.match(load({ sheetState: s, email: 'x@y.com' }).ctx.doGet().html, /không có quyền/);
  assert.equal(load({ sheetState: s }).ctx.doGet().file, 'Index');
});

test('đọc đúng dữ liệu, giữ số 0 đầu của điện thoại', () => {
  const s = fixture();
  const { ctx } = load({ sheetState: s });
  const r = ctx.apiLoad();
  assert.equal(r.ok, true);
  assert.equal(r.data.rows.length, 3);
  assert.equal(r.data.rows[2].phone, '0912778004');
  assert.equal(r.data.rows[0].name, '[KIỂM TRA HỆ THỐNG] F2 01');
  assert.equal(typeof r.data.rows[1].phone, 'string');
});

test('ô ngày được đổi về ISO +07:00', () => {
  const s = makeSheet([toRow(reg(1, { createdAt: new Date('2026-11-14T13:41:53Z') }))]);
  const row = load({ sheetState: s }).ctx.apiLoad().data.rows[0];
  assert.equal(row.createdAt, '2026-11-14T20:41:53+07:00');
});

test('báo lỗi khi tiêu đề sai hoặc thiếu cấu hình', () => {
  const bad = makeSheet([], { header: [...HEADERS.slice(0, 12), 'sai'] });
  assert.equal(load({ sheetState: bad }).ctx.apiLoad().error, 'schema');
  assert.equal(load({ sheetState: fixture(), props: { OWNER_EMAIL: OWNER } }).ctx.apiLoad().error, 'not_configured');
});

test('Trang tính không có dữ liệu trả về danh sách rỗng', () => {
  const r = load({ sheetState: makeSheet([]) }).ctx.apiLoad();
  assert.equal(r.ok, true);
  assert.equal(r.data.rows.length, 0);
});

test('đi qua new → contacted → confirmed → cancelled, A đến H không đổi', () => {
  const s = fixture();
  const { ctx } = load({ sheetState: s });
  const snapAH = (n) => HEADERS.slice(0, 8).map((_, i) => s.get(n, i + 1).v);
  const a = snapAH(3);
  let row = ctx.apiLoad().data.rows[1];
  for (const status of ['contacted', 'confirmed', 'cancelled']) {
    const r = ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: row.updatedAt, status });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.row.status, status);
    assert.match(r.row.updatedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+07:00$/);
    row = r.row;
  }
  assert.match(row.confirmedAt, /\+07:00$/);
  assert.equal(row.contactLog.split('\n').length, 3);
  assert.match(row.contactLog, /Mới → Đang tư vấn/);
  assert.deepEqual(snapAH(3), a);
});

test('chỉ ghi vào cột I đến M của đúng một dòng, không động dòng khác', () => {
  const s = fixture();
  const { ctx } = load({ sheetState: s });
  const others = [2, 4].map((n) => JSON.stringify(HEADERS.map((_, i) => s.get(n, i + 1))));
  const row = ctx.apiLoad().data.rows[1];
  ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: row.updatedAt, note: 'Gọi lại chiều nay', logEntry: 'Đã gọi, hẹn 17h' });
  assert.equal(s.writes.length, 1);
  assert.deepEqual(s.writes[0], { r: 3, c: 9, nr: 1, nc: 5 });
  assert.deepEqual([2, 4].map((n) => JSON.stringify(HEADERS.map((_, i) => s.get(n, i + 1)))), others);
  assert.equal(s.get(1, 1).v, 'id');
});

test('xác định dòng theo id, kể cả khi thứ tự dòng đổi', () => {
  const s = makeSheet([toRow(reg(3)), toRow(reg(2)), toRow(reg(1))]);
  const { ctx } = load({ sheetState: s });
  const r = ctx.apiUpdate({ id: 'DK0001', expectedUpdatedAt: '', status: 'contacted' });
  assert.equal(r.ok, true);
  assert.equal(s.get(4, 9).v, 'contacted');
  assert.equal(s.get(2, 9).v, 'new');
  assert.equal(ctx.apiUpdate({ id: 'DK0999', expectedUpdatedAt: '', status: 'contacted' }).error, 'not_found');
});

test('phát hiện xung đột giữa hai phiên và không ghi đè', () => {
  const s = fixture();
  const { ctx } = load({ sheetState: s });
  const stale = ctx.apiLoad().data.rows[1];
  assert.equal(ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: stale.updatedAt, note: 'Phiên A' }).ok, true);
  const second = ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: stale.updatedAt, note: 'Phiên B' });
  assert.equal(second.ok, false);
  assert.equal(second.error, 'conflict');
  assert.equal(second.row.note, 'Phiên A');
  assert.equal(s.get(3, 10).v, 'Phiên A');
});

test('báo bận khi không lấy được khóa, không ghi gì', () => {
  const s = fixture();
  const before = s.snapshot();
  const r = load({ sheetState: s, lockFails: true }).ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: '', note: 'x' });
  assert.equal(r.error, 'busy');
  assert.equal(s.snapshot(), before);
});

test('ghi chú bắt đầu bằng = không thành công thức', () => {
  const s = fixture();
  const { ctx } = load({ sheetState: s });
  const r = ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: '', note: '=HYPERLINK("http://evil","x")', logEntry: '=1+1' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.row.note, '=HYPERLINK("http://evil","x")');
  for (let c = 9; c <= 13; c++) assert.equal(s.get(3, c).f, '');
});

test('nhật ký nối thêm vào dữ liệu cũ, không chuyển đổi định dạng cũ', () => {
  const legacy = 'Gọi hôm qua, chưa nghe máy';
  const s = makeSheet([toRow(reg(2, { contactLog: legacy }))]);
  const { ctx } = load({ sheetState: s });
  const r = ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: '', logEntry: 'Đã nhắn Zalo\nhẹn mai' });
  const lines = r.row.contactLog.split('\n');
  assert.equal(lines[0], legacy);
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^\d{4}-\d\d-\d\d \d\d:\d\d \| Đã nhắn Zalo \/ hẹn mai$/);
});

test('không có thay đổi thì không ghi', () => {
  const s = fixture();
  const { ctx } = load({ sheetState: s });
  const r = ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: '', status: 'new' });
  assert.equal(r.unchanged, true);
  assert.equal(s.writes.length, 0);
});

test('từ chối đầu vào không hợp lệ', () => {
  const { ctx } = load({ sheetState: fixture() });
  const bad = [
    null, {}, { id: '2', expectedUpdatedAt: '', status: 'new' }, { id: 'DK0002', expectedUpdatedAt: '' },
    { id: 'DK0002', expectedUpdatedAt: '', status: 'paid' }, { id: 'DK0002', expectedUpdatedAt: 5, status: 'new' },
    { id: 'DK0002', expectedUpdatedAt: '', note: 'x'.repeat(2001) }, { id: 'DK0002', expectedUpdatedAt: '', logEntry: 'x'.repeat(1001) },
    { id: 'DK0002', expectedUpdatedAt: '', note: 7 },
  ];
  for (const b of bad) assert.equal(ctx.apiUpdate(b).error, 'invalid', JSON.stringify(b));
});

test('từ chối khi nhật ký quá dài', () => {
  const s = makeSheet([toRow(reg(2, { contactLog: 'x'.repeat(44990) }))]);
  const r = load({ sheetState: s }).ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: '', logEntry: 'thêm một dòng' });
  assert.equal(r.error, 'log_full');
});

test('đọc lại thấy A đến H bị đổi giữa chừng thì báo verify_failed', () => {
  const s = fixture();
  const { ctx, logs } = load({ sheetState: s, mutateOnWrite: () => { s.get(3, 3).v = 'ĐÃ BỊ ĐỔI'; } });
  const r = ctx.apiUpdate({ id: 'DK0002', expectedUpdatedAt: '', note: 'x' });
  assert.equal(r.error, 'verify_failed');
  assert.ok(logs.length > 0);
});

test('nhật ký lỗi không chứa dữ liệu học viên', () => {
  const s = fixture();
  s.sheet.getRange = () => { throw new Error('Service unavailable'); };
  const { ctx, logs } = load({ sheetState: s });
  assert.equal(ctx.apiLoad().error, 'server_error');
  assert.ok(logs.every((l) => !/Học viên|0900/.test(l)));
});
