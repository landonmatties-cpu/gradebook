/*
 * End-to-end workflow test. Reproduces the exact data operations the renderer
 * performs when a teacher uses the app, then checks the resulting grades. This
 * verifies the whole pipeline (template -> class -> assignments -> grades ->
 * overall) without needing the Electron GUI.
 */
const calc = require('../src/calc.js');
const CURR = require('../src/bc-curriculum.js');

let passed = 0, failed = 0;
function assert(name, cond) {
  if (cond) { passed++; console.log('  ok  - ' + name); }
  else { failed++; console.error('FAIL  - ' + name); }
}
function approx(a, b) { return a !== null && b !== null && Math.abs(a - b) <= 1e-9; }
let seq = 0;
function uid() { return 'id' + (seq++); }

// --- renderer helpers (mirrors src/renderer.js) ---
function assignmentsByCategory(cls) {
  const map = {};
  cls.categories.forEach(c => { map[c.id] = []; });
  cls.assignments.forEach(a => { (map[a.categoryId] = map[a.categoryId] || []).push(a); });
  return map;
}
function gradesForStudent(cls, sid) {
  const out = {};
  cls.assignments.forEach(a => { if (a.grades && a.grades[sid]) out[a.id] = a.grades[sid]; });
  return out;
}
function studentOverall(cls, sid) {
  return calc.overallGrade(cls.categories, assignmentsByCategory(cls), gradesForStudent(cls, sid));
}

// --- 1. build a Math class from the BC template ---
const tpl = CURR.SUBJECT_TEMPLATES.find(t => t.id === 'math');
assert('math template exists with competencies', tpl && tpl.competencies.length > 0);

const cls = {
  id: uid(), name: 'Math 8 — Block A', subject: 'Mathematics',
  students: [], competencies: [], categories: [], assignments: []
};
cls.competencies = tpl.competencies.map(c => ({ id: uid(), name: c.name, area: c.area }));
cls.categories = CURR.DEFAULT_CATEGORIES.map(c => ({ id: uid(), name: c.name, weight: c.weight }));
assert('class seeded with template competencies', cls.competencies.length === tpl.competencies.length);
assert('class seeded with default categories', cls.categories.length === CURR.DEFAULT_CATEGORIES.length);

// --- 2. add students ---
['Ava', 'Ben', 'Chloe'].forEach(n => cls.students.push({ id: uid(), name: n }));
const [ava, ben, chloe] = cls.students;

// --- 3. create an assignment in the "Quizzes" category with 2 competencies ---
const quizzes = cls.categories.find(c => c.name === 'Quizzes');
const compA = cls.competencies[0], compB = cls.competencies[1];
const quiz = {
  id: uid(), title: 'Fractions Quiz', categoryId: quizzes.id,
  competencies: [
    { competencyId: compA.id, weight: 3 },
    { competencyId: compB.id, weight: 1 }
  ],
  grades: {}
};
cls.assignments.push(quiz);

// --- 4. enter grades (typed numbers 1-8) ---
quiz.grades[ava.id]   = { scores: { [compA.id]: 6, [compB.id]: 2 }, excused: false }; // (6*3+2*1)/4 = 5
quiz.grades[ben.id]   = { scores: { [compA.id]: 8, [compB.id]: 8 }, excused: false }; // 8
quiz.grades[chloe.id] = { scores: {}, excused: true };                                // excused

assert('Ava quiz overall = 5 (Proficient -)', approx(calc.assignmentScore(quiz, quiz.grades[ava.id].scores), 5));
assert('Ava label is Proficient -', calc.labelForValue(5) === 'Proficient -');
assert('Ben quiz overall = 8 (Extending)', approx(calc.assignmentScore(quiz, quiz.grades[ben.id].scores), 8));

// --- 5. add a second category assignment (Projects) ---
const projects = cls.categories.find(c => c.name === 'Projects');
const project = {
  id: uid(), title: 'Data Project', categoryId: projects.id,
  competencies: [{ competencyId: compA.id, weight: 1 }],
  grades: {}
};
cls.assignments.push(project);
project.grades[ava.id] = { scores: { [compA.id]: 7 }, excused: false };
project.grades[ben.id] = { scores: { [compA.id]: 4 }, excused: false };
// Chloe excused from quiz, and ungraded on project -> project ungraded too

// --- 6. overall class grade weighting categories ---
// Ava: Quizzes(w20)=5, Projects(w25)=7  -> (5*20 + 7*25)/45 = 6.111...
const avaOverall = studentOverall(cls, ava.id);
assert('Ava overall weighted across categories', approx(avaOverall.value, (5 * 20 + 7 * 25) / 45));

// Ben: Quizzes=8, Projects=4 -> (8*20 + 4*25)/45 = 5.777...
const benOverall = studentOverall(cls, ben.id);
assert('Ben overall weighted across categories', approx(benOverall.value, (8 * 20 + 4 * 25) / 45));

// Chloe: excused from the only quiz, no project grade -> no counted work -> null
const chloeOverall = studentOverall(cls, chloe.id);
assert('Chloe overall is null (all work excused/ungraded)', chloeOverall.value === null);

// --- 7. excusing Ava from the project should drop it from her Projects category ---
project.grades[ava.id] = { scores: {}, excused: true };
const avaAfterExcuse = studentOverall(cls, ava.id);
assert('Ava overall falls back to Quizzes only after excusing project = 5', approx(avaAfterExcuse.value, 5));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
