/*
 * Minimal test runner (no dependencies) for the grade calculation logic.
 * Run with: npm test
 */
const calc = require('../src/calc.js');

let passed = 0;
let failed = 0;

function approx(a, b, eps) {
  eps = eps || 1e-9;
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= eps;
}

function assert(name, cond) {
  if (cond) {
    passed++;
    console.log('  ok  - ' + name);
  } else {
    failed++;
    console.error('FAIL  - ' + name);
  }
}

// --- proficiency scale mapping ---
assert('1 maps to Emerging', calc.labelForValue(1) === 'Emerging');
assert('8 maps to Extending', calc.labelForValue(8) === 'Extending');
assert('6 maps to Proficient', calc.labelForValue(6) === 'Proficient');
assert('5.6 rounds to Proficient', calc.labelForValue(5.6) === 'Proficient');
assert('out-of-range high clamps to Extending', calc.labelForValue(12) === 'Extending');
assert('out-of-range low clamps to Emerging', calc.labelForValue(-3) === 'Emerging');
assert('empty value has no label', calc.labelForValue(null) === '');

// --- weighted assignment score ---
const assignment = {
  competencies: [
    { competencyId: 'c1', weight: 3 },
    { competencyId: 'c2', weight: 1 }
  ]
};
assert(
  'weighted assignment score (6*3 + 2*1)/4 = 5',
  approx(calc.assignmentScore(assignment, { c1: 6, c2: 2 }), 5)
);
assert(
  'ungraded competency is renormalized out',
  approx(calc.assignmentScore(assignment, { c1: 7 }), 7)
);
assert(
  'no grades yields null',
  calc.assignmentScore(assignment, {}) === null
);

// --- category average (excused + ungraded skipped) ---
const catAssignments = [
  { id: 'a1', competencies: [{ competencyId: 'c1', weight: 1 }] },
  { id: 'a2', competencies: [{ competencyId: 'c1', weight: 1 }] },
  { id: 'a3', competencies: [{ competencyId: 'c1', weight: 1 }] }
];
const grades = {
  a1: { scores: { c1: 4 } },
  a2: { scores: { c1: 8 } },
  a3: { excused: true, scores: { c1: 1 } } // excused → ignored
};
assert(
  'category average skips excused: (4+8)/2 = 6',
  approx(calc.categoryAverage(catAssignments, grades), 6)
);

// --- overall grade weighted by category ---
const categories = [
  { id: 'cat1', name: 'Tests', weight: 3 },
  { id: 'cat2', name: 'Homework', weight: 1 }
];
const assignmentsByCategory = {
  cat1: [{ id: 't1', competencies: [{ competencyId: 'c1', weight: 1 }] }],
  cat2: [{ id: 'h1', competencies: [{ competencyId: 'c1', weight: 1 }] }]
};
const g2 = {
  t1: { scores: { c1: 8 } },
  h1: { scores: { c1: 4 } }
};
const overall = calc.overallGrade(categories, assignmentsByCategory, g2);
assert('overall weighted (8*3 + 4*1)/4 = 7', approx(overall.value, 7));

// empty category renormalizes out
const g3 = { t1: { scores: { c1: 8 } } }; // homework ungraded
const overall2 = calc.overallGrade(categories, assignmentsByCategory, g3);
assert('overall drops empty category: = 8', approx(overall2.value, 8));

// --- grid navigation (Enter = row-major; arrows = directional) ---
const none = () => false;
// 3 rows x 2 cols, nothing disabled
let t = calc.nextEditableRowMajor(3, 2, none, 0, 0);
assert('Enter from (0,0) -> next box for student (0,1)', t.r === 0 && t.c === 1);
t = calc.nextEditableRowMajor(3, 2, none, 0, 1);
assert('Enter at end of student row -> next student (1,0)', t.r === 1 && t.c === 0);
t = calc.nextEditableRowMajor(3, 2, none, 2, 1);
assert('Enter at last cell wraps to (0,0)', t.r === 0 && t.c === 0);
// skip a disabled (excused) cell
const disAt10 = (r, c) => (r === 1 && c === 0);
t = calc.nextEditableRowMajor(3, 2, disAt10, 0, 1);
assert('Enter skips excused (1,0) -> (1,1)', t.r === 1 && t.c === 1);

// arrows in all four directions
assert('ArrowRight (0,0)->(0,1)', calc.nextEditableInDir(3, 2, none, 0, 0, 0, 1).c === 1);
assert('ArrowLeft (0,1)->(0,0)', calc.nextEditableInDir(3, 2, none, 0, 1, 0, -1).c === 0);
assert('ArrowDown (0,0)->(1,0)', calc.nextEditableInDir(3, 2, none, 0, 0, 1, 0).r === 1);
assert('ArrowUp (1,0)->(0,0)', calc.nextEditableInDir(3, 2, none, 1, 0, -1, 0).r === 0);
assert('ArrowLeft at edge returns null', calc.nextEditableInDir(3, 2, none, 0, 0, 0, -1) === null);
assert('ArrowDown skips disabled row', calc.nextEditableInDir(3, 2, disAt10, 0, 0, 1, 0).r === 2);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
