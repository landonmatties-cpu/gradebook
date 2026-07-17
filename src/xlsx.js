/*
 * xlsx.js — a tiny, dependency-free .xlsx (Excel) writer.
 *
 * Builds a minimal but valid OOXML spreadsheet (a ZIP of XML parts) so the app
 * can export without bundling a spreadsheet library. Cells are written as
 * inline strings, or as numbers when the value is a finite JS number.
 *
 * Pure Node (no Electron/DOM) so it can be unit-tested. Used by main.js.
 *
 *   buildWorkbook([{ name, rows: [[cell, ...], ...] }, ...]) -> Buffer
 */
'use strict';

// ---- CRC32 (needed for ZIP entries) ----
var CRC_TABLE = (function () {
  var t = new Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---- ZIP (store / no compression) ----
function buildZip(files) {
  var chunks = [], central = [], offset = 0;
  var DOS_DATE = 20513, DOS_TIME = 0; // 2020-01-01
  files.forEach(function (f) {
    var nameBuf = Buffer.from(f.name, 'utf8');
    var data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    var crc = crc32(data);

    var local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);          // store
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);

    var cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));

    offset += local.length + nameBuf.length + data.length;
  });

  var centralBuf = Buffer.concat(central);
  var end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat(chunks.concat([centralBuf, end]));
}

// ---- XML helpers ----
function xmlEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function colLetter(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Excel sheet names: <=31 chars, none of []:*?/\, and unique.
function sanitizeSheetNames(sheets) {
  var used = {};
  return sheets.map(function (sh, i) {
    var base = String(sh.name || ('Sheet' + (i + 1))).replace(/[\[\]:*?\/\\]/g, '-').trim().slice(0, 31);
    if (!base) base = 'Sheet' + (i + 1);
    var name = base, n = 2;
    while (used[name.toLowerCase()]) {
      var suffix = ' (' + n + ')';
      name = base.slice(0, 31 - suffix.length) + suffix;
      n++;
    }
    used[name.toLowerCase()] = true;
    return name;
  });
}

function sheetXml(rows) {
  var out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  (rows || []).forEach(function (row, ri) {
    out += '<row r="' + (ri + 1) + '">';
    (row || []).forEach(function (cell, ci) {
      var ref = colLetter(ci + 1) + (ri + 1);
      if (typeof cell === 'number' && isFinite(cell)) {
        out += '<c r="' + ref + '"><v>' + cell + '</v></c>';
      } else {
        out += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' +
          xmlEsc(cell) + '</t></is></c>';
      }
    });
    out += '</row>';
  });
  out += '</sheetData></worksheet>';
  return out;
}

function buildWorkbook(sheets) {
  if (!sheets || !sheets.length) sheets = [{ name: 'Sheet1', rows: [] }];
  var names = sanitizeSheetNames(sheets);

  var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets.map(function (_, i) {
      return '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
        '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }).join('') + '</Types>';

  var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  var wbSheets = sheets.map(function (_, i) {
    return '<sheet name="' + xmlEsc(names[i]) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
  }).join('');
  var workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' + wbSheets + '</sheets></workbook>';

  var wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map(function (_, i) {
      return '<Relationship Id="rId' + (i + 1) +
        '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
        'Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    }).join('') + '</Relationships>';

  var files = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: wbRels }
  ];
  sheets.forEach(function (sh, i) {
    files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(sh.rows) });
  });

  return buildZip(files);
}

module.exports = { buildWorkbook: buildWorkbook, sanitizeSheetNames: sanitizeSheetNames, colLetter: colLetter };
