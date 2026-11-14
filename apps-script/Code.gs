/*
 * MORI Admin: Apps Script độc lập, chỉ chủ lớp dùng.
 * Cấu hình trong Script Properties (không ghi vào mã):
 *   SPREADSHEET_ID  ID Trang tính nhận đăng ký
 *   OWNER_EMAIL     email tài khoản chủ lớp, duy nhất được đọc và ghi
 * Không có API công khai. Mọi hàm đọc và ghi đều kiểm tra chủ lớp ở phía máy chủ.
 * App chỉ ghi cột I đến M của một dòng, xác định theo id. Không đụng cột A đến H.
 */
var HEADERS = ['id', 'createdAt', 'name', 'phone', 'email', 'workshop', 'preferredContact', 'message', 'status', 'note', 'contactLog', 'confirmedAt', 'updatedAt'];
var SHEET_NAME = 'DangKy';
var STATUSES = ['new', 'contacted', 'confirmed', 'cancelled'];
var STATUS_LABEL = { new: 'Mới', contacted: 'Đang tư vấn', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy' };
var TZ = 'Asia/Ho_Chi_Minh';
var FIRST_APP_COL = 9; // cột I
var APP_COLS = 5; // I đến M
var NOTE_MAX = 2000;
var LOG_ENTRY_MAX = 1000;
var LOG_CELL_MAX = 45000; // ô Trang tính tối đa 50.000 ký tự
var LOCK_WAIT_MS = 15000;
var ID_PATTERN = /^DK\d{4,}$/;

function doGet() {
  if (!currentUser_().allowed) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>MORI Admin</title><p style="font:16px system-ui;padding:24px">Bạn không có quyền truy cập ứng dụng này.</p>');
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('MORI Admin')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Tải toàn bộ đăng ký. Chỉ đọc. */
function apiLoad() {
  var user = currentUser_();
  if (!user.allowed) return fail_('forbidden');
  try {
    var sheet = openSheet_();
    return { ok: true, data: { rows: readAllRows_(sheet), user: user.email, loadedAt: nowIso_(), sheetName: SHEET_NAME } };
  } catch (err) {
    return failFrom_(err, 'apiLoad');
  }
}

/**
 * Cập nhật một đăng ký.
 * payload: { id, expectedUpdatedAt, status?, note?, logEntry? }
 */
function apiUpdate(payload) {
  var user = currentUser_();
  if (!user.allowed) return fail_('forbidden');
  var req = validateUpdate_(payload);
  if (!req) return fail_('invalid');

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (_) {
    return fail_('busy');
  }
  try {
    var sheet = openSheet_();
    var rowNumber = findRowNumber_(sheet, req.id);
    if (!rowNumber) return fail_('not_found');

    var before = readRow_(sheet, rowNumber);
    if (before.id !== req.id) return fail_('not_found'); // dòng đã dịch chuyển giữa hai lần đọc
    if (before.updatedAt !== req.expectedUpdatedAt) return { ok: false, error: 'conflict', row: before };

    var next = applyChanges_(before, req);
    if (!next) return { ok: true, unchanged: true, row: before };
    if (next.error) return fail_(next.error);

    var target = sheet.getRange(rowNumber, FIRST_APP_COL, 1, APP_COLS);
    target.setNumberFormat('@'); // ép văn bản thuần: không bao giờ thành công thức hay ngày
    target.setValues([[next.status, next.note, next.contactLog, next.confirmedAt, next.updatedAt]]);
    SpreadsheetApp.flush();

    var after = readRow_(sheet, rowNumber);
    if (!verifyWrite_(before, after, next, target)) {
      console.error('apiUpdate verification failed');
      return fail_('verify_failed');
    }
    return { ok: true, row: after };
  } catch (err) {
    return failFrom_(err, 'apiUpdate');
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Xác thực ---------- */

function currentUser_() {
  var owner = String(PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL') || '').trim().toLowerCase();
  var email = '';
  try {
    email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (_) {
    email = '';
  }
  return { email: email, allowed: !!owner && !!email && email === owner }; // thiếu cấu hình hoặc không rõ người dùng: từ chối
}

/* ---------- Trang tính ---------- */

function openSheet_() {
  var id = String(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '').trim();
  if (!id) throw coded_('not_configured');
  var sheet = SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
  if (!sheet) throw coded_('no_sheet');
  if (sheet.getLastColumn() < HEADERS.length) throw coded_('schema');
  var header = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  for (var i = 0; i < HEADERS.length; i++) {
    if (header[i] !== HEADERS[i]) throw coded_('schema');
  }
  return sheet;
}

function readAllRows_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var range = sheet.getRange(2, 1, last - 1, HEADERS.length);
  var values = range.getValues();
  var shown = range.getDisplayValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var row = toRow_(values[i], shown[i]);
    if (row.id) rows.push(row);
  }
  return rows;
}

function readRow_(sheet, rowNumber) {
  var range = sheet.getRange(rowNumber, 1, 1, HEADERS.length);
  return toRow_(range.getValues()[0], range.getDisplayValues()[0]);
}

function findRowNumber_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var ids = sheet.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return 0;
}

/** Chuẩn hóa mọi ô thành chuỗi. Ô ngày được đổi về ISO +07:00, ô văn bản giữ nguyên (không mất số 0 đầu). */
function toRow_(values, shown) {
  var row = {};
  for (var i = 0; i < HEADERS.length; i++) {
    var v = values[i];
    var isDate = Object.prototype.toString.call(v) === '[object Date]';
    row[HEADERS[i]] = isDate ? formatIso_(v) : String(shown[i] === undefined ? '' : shown[i]);
  }
  return row;
}

/* ---------- Thay đổi ---------- */

function validateUpdate_(p) {
  if (!p || typeof p !== 'object') return null;
  if (typeof p.id !== 'string' || !ID_PATTERN.test(p.id)) return null;
  if (typeof p.expectedUpdatedAt !== 'string' || p.expectedUpdatedAt.length > 40) return null;
  var req = { id: p.id, expectedUpdatedAt: p.expectedUpdatedAt };
  if (p.status !== undefined) {
    if (STATUSES.indexOf(p.status) < 0) return null;
    req.status = p.status;
  }
  if (p.note !== undefined) {
    var note = cleanText_(p.note, true);
    if (note === null || note.length > NOTE_MAX) return null;
    req.note = note;
  }
  if (p.logEntry !== undefined) {
    var entry = cleanText_(p.logEntry, false);
    if (entry === null || entry.length > LOG_ENTRY_MAX) return null;
    if (entry) req.logEntry = entry;
  }
  if (req.status === undefined && req.note === undefined && req.logEntry === undefined) return null;
  return req;
}

/** Bỏ ký tự điều khiển. Nhật ký: gộp xuống dòng để mỗi mục luôn là một dòng. */
function cleanText_(value, keepNewlines) {
  if (typeof value !== 'string') return null;
  var text = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return keepNewlines ? text : text.replace(/\s*\n+\s*/g, ' / ');
}

/** Trả về giá trị I đến M mới, null nếu không có gì đổi, hoặc {error}. */
function applyChanges_(before, req) {
  var now = new Date();
  var stamp = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm');
  var next = { status: before.status, note: before.note, contactLog: before.contactLog, confirmedAt: before.confirmedAt, updatedAt: formatIso_(now) };
  var lines = [];
  var changed = false;

  if (req.status !== undefined && req.status !== before.status) {
    lines.push('Trạng thái: ' + (STATUS_LABEL[before.status] || before.status || '(trống)') + ' → ' + STATUS_LABEL[req.status]);
    next.status = req.status;
    if (req.status === 'confirmed') next.confirmedAt = next.updatedAt;
    changed = true;
  }
  if (req.note !== undefined && req.note !== before.note) {
    next.note = req.note;
    changed = true;
  }
  if (req.logEntry) {
    lines.push(req.logEntry);
    changed = true;
  }
  if (!changed) return null;

  for (var i = 0; i < lines.length; i++) {
    var line = stamp + ' | ' + lines[i];
    if ((next.contactLog + '\n' + line).length > LOG_CELL_MAX) return { error: 'log_full' };
    next.contactLog = next.contactLog ? next.contactLog + '\n' + line : line; // chỉ nối thêm, không chuyển đổi dữ liệu cũ
  }
  return next;
}

/** Đọc lại sau khi ghi: A đến H không đổi, I đến M đúng giá trị định ghi, không ô nào thành công thức. */
function verifyWrite_(before, after, next, target) {
  for (var i = 0; i < FIRST_APP_COL - 1; i++) {
    if (before[HEADERS[i]] !== after[HEADERS[i]]) return false;
  }
  var expected = [next.status, next.note, next.contactLog, next.confirmedAt, next.updatedAt];
  for (var j = 0; j < APP_COLS; j++) {
    if (after[HEADERS[FIRST_APP_COL - 1 + j]] !== expected[j]) return false;
  }
  var formulas = target.getFormulas()[0];
  for (var k = 0; k < formulas.length; k++) {
    if (formulas[k]) return false;
  }
  return true;
}

/* ---------- Tiện ích ---------- */

function formatIso_(date) {
  return Utilities.formatDate(date, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function nowIso_() {
  return formatIso_(new Date());
}

function fail_(code) {
  return { ok: false, error: code };
}

function coded_(code) {
  var err = new Error(code);
  err.code = code;
  return err;
}

function failFrom_(err, where) {
  var known = ['not_configured', 'no_sheet', 'schema'];
  if (err && known.indexOf(err.code) >= 0) return fail_(err.code);
  console.error(where + ' failed: ' + (err && err.message ? err.message : 'unknown'));
  return fail_('server_error');
}
