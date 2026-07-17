/* Tests for the dependency-free xlsx writer. */
const xlsx = require('../src/xlsx.js');

let passed = 0, failed = 0;
function assert(name, cond) {
  if (cond) { passed++; console.log('  ok  - ' + name); }
  else { failed++; console.error('FAIL  - ' + name); }
}

// column letters
assert('colLetter 1 = A', xlsx.colLetter(1) === 'A');
assert('colLetter 26 = Z', xlsx.colLetter(26) === 'Z');
assert('colLetter 27 = AA', xlsx.colLetter(27) === 'AA');
assert('colLetter 28 = AB', xlsx.colLetter(28) === 'AB');
assert('colLetter 702 = ZZ', xlsx.colLetter(702) === 'ZZ');
assert('colLetter 703 = AAA', xlsx.colLetter(703) === 'AAA');

// sheet-name sanitizing
const names = xlsx.sanitizeSheetNames([
  { name: 'Homeroom 8A' },
  { name: 'Math [Block:D]/x*?' },
  { name: 'Homeroom 8A' },        // duplicate
  { name: '' }                     // empty
]);
assert('valid name kept', names[0] === 'Homeroom 8A');
assert('invalid chars stripped', !/[\[\]:*?\/\\]/.test(names[1]));
assert('duplicate made unique', names[2] !== names[0]);
assert('empty name gets a default', names[3].length > 0);
assert('names are <= 31 chars', names.every(n => n.length <= 31));
const longName = xlsx.sanitizeSheetNames([{ name: 'x'.repeat(50) }])[0];
assert('overlong name truncated to 31', longName.length === 31);

// workbook bytes look like a zip ("PK")
const buf = xlsx.buildWorkbook([{ name: 'S1', rows: [['Student', 'Overall'], ['Ava', 6.5], ['Ben', '']] }]);
assert('buildWorkbook returns a Buffer', Buffer.isBuffer(buf));
assert('workbook starts with ZIP magic PK', buf[0] === 0x50 && buf[1] === 0x4B);
assert('workbook is non-trivial in size', buf.length > 500);

// empty input still yields a valid workbook
const empty = xlsx.buildWorkbook([]);
assert('empty workbook still a zip', empty[0] === 0x50 && empty[1] === 0x4B);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
