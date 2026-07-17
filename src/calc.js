/*
 * calc.js — pure grade/proficiency calculation logic.
 *
 * This module contains NO DOM or Electron code so it can be unit-tested in
 * Node and reused directly in the renderer. It is exposed both as a CommonJS
 * module (for tests) and on window.GradebookCalc (for the browser).
 */
(function (root) {
  'use strict';

  // The modified BC proficiency scale requested by the teacher.
  // value is the number typed during grade entry (1-8).
  var PROFICIENCY_LEVELS = [
    { value: 1, key: 'emerging',         label: 'Emerging',      short: 'EM',  color: '#e57373' },
    { value: 2, key: 'developing-minus', label: 'Developing -',  short: 'DE-', color: '#f0a35e' },
    { value: 3, key: 'developing',       label: 'Developing',    short: 'DE',  color: '#f5b942' },
    { value: 4, key: 'developing-plus',  label: 'Developing +',  short: 'DE+', color: '#e6cf3f' },
    { value: 5, key: 'proficient-minus', label: 'Proficient -',  short: 'PR-', color: '#bcd45f' },
    { value: 6, key: 'proficient',       label: 'Proficient',    short: 'PR',  color: '#8bc34a' },
    { value: 7, key: 'proficient-plus',  label: 'Proficient +',  short: 'PR+', color: '#5cb85c' },
    { value: 8, key: 'extending',        label: 'Extending',     short: 'EX',  color: '#3a9d6b' }
  ];

  var MIN_VALUE = 1;
  var MAX_VALUE = 8;

  function clampValue(v) {
    if (v < MIN_VALUE) return MIN_VALUE;
    if (v > MAX_VALUE) return MAX_VALUE;
    return v;
  }

  // Return the proficiency level object for a numeric value (nearest level).
  function levelForValue(value) {
    if (value === null || value === undefined || isNaN(value)) return null;
    var rounded = Math.round(clampValue(value));
    return PROFICIENCY_LEVELS[rounded - 1] || null;
  }

  function labelForValue(value) {
    var lvl = levelForValue(value);
    return lvl ? lvl.label : '';
  }

  function shortForValue(value) {
    var lvl = levelForValue(value);
    return lvl ? lvl.short : '';
  }

  function colorForValue(value) {
    var lvl = levelForValue(value);
    return lvl ? lvl.color : '#cccccc';
  }

  /*
   * Compute the overall numeric score for one student on one assignment.
   *
   * assignment.competencies: [{ competencyId, weight }]
   * scores: { [competencyId]: number|null }  (numeric 1-8, or null/undefined if
   *          not yet graded)
   *
   * Returns a weighted average over the competencies that actually have a
   * score, renormalizing weights so ungraded competencies don't count.
   * Returns null if no competency has been graded.
   */
  function assignmentScore(assignment, scores) {
    if (!assignment || !assignment.competencies) return null;
    scores = scores || {};
    var totalWeight = 0;
    var weightedSum = 0;
    for (var i = 0; i < assignment.competencies.length; i++) {
      var ac = assignment.competencies[i];
      var raw = scores[ac.competencyId];
      var val = toNumber(raw);
      if (val === null) continue;
      var w = (typeof ac.weight === 'number' && ac.weight > 0) ? ac.weight : 0;
      if (w <= 0) continue;
      totalWeight += w;
      weightedSum += w * val;
    }
    if (totalWeight <= 0) return null;
    return weightedSum / totalWeight;
  }

  function toNumber(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    var n = Number(raw);
    if (isNaN(n)) return null;
    return clampValue(n);
  }

  /*
   * Category average for one student.
   *
   * assignments: list of assignment objects belonging to the category.
   * gradesByAssignment: { [assignmentId]: { scores: {compId: n}, excused: bool } }
   *
   * Excused assignments and assignments with no grade are skipped. Each
   * counted assignment contributes equally. Returns null if nothing counts.
   */
  function categoryAverage(assignments, gradesByAssignment) {
    if (!assignments || !assignments.length) return null;
    gradesByAssignment = gradesByAssignment || {};
    var sum = 0;
    var count = 0;
    for (var i = 0; i < assignments.length; i++) {
      var a = assignments[i];
      var g = gradesByAssignment[a.id];
      if (g && g.excused) continue;
      var score = assignmentScore(a, g ? g.scores : null);
      if (score === null) continue;
      sum += score;
      count += 1;
    }
    if (count === 0) return null;
    return sum / count;
  }

  /*
   * Overall class grade for one student, weighting categories by their weight.
   *
   * categories: [{ id, name, weight }]
   * assignmentsByCategory: { [categoryId]: [assignment, ...] }
   * gradesByAssignment: { [assignmentId]: { scores, excused } }
   *
   * Categories with no counted assignments are dropped and the remaining
   * category weights are renormalized. Returns { value, breakdown } where
   * breakdown lists each category's average.
   */
  function overallGrade(categories, assignmentsByCategory, gradesByAssignment) {
    var breakdown = [];
    var totalWeight = 0;
    var weightedSum = 0;
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var assignments = assignmentsByCategory[cat.id] || [];
      var avg = categoryAverage(assignments, gradesByAssignment);
      breakdown.push({ categoryId: cat.id, name: cat.name, weight: cat.weight, average: avg });
      if (avg === null) continue;
      var w = (typeof cat.weight === 'number' && cat.weight > 0) ? cat.weight : 0;
      if (w <= 0) continue;
      totalWeight += w;
      weightedSum += w * avg;
    }
    var value = totalWeight > 0 ? weightedSum / totalWeight : null;
    return { value: value, breakdown: breakdown };
  }

  /*
   * Grid navigation helpers for the gradebook grading cells. Pure functions so
   * they can be unit-tested; the renderer supplies isDisabled(r,c) to skip
   * excused/empty cells.
   */
  // Row-major "next cell": advances across the student's row, then to the next
  // student, wrapping around. Used for the Enter key.
  function nextEditableRowMajor(nRows, nCols, isDisabled, r, c) {
    var total = nRows * nCols;
    if (total <= 0) return null;
    var pos = r * nCols + c;
    for (var k = 1; k <= total; k++) {
      var p = (pos + k) % total;
      var rr = Math.floor(p / nCols), cc = p % nCols;
      if (!isDisabled(rr, cc)) return { r: rr, c: cc };
    }
    return null;
  }
  // Directional "next cell": steps by (dr,dc) skipping disabled cells until an
  // enabled one is found or the grid edge is reached. Used for arrow keys.
  function nextEditableInDir(nRows, nCols, isDisabled, r, c, dr, dc) {
    r += dr; c += dc;
    while (r >= 0 && r < nRows && c >= 0 && c < nCols) {
      if (!isDisabled(r, c)) return { r: r, c: c };
      r += dr; c += dc;
    }
    return null;
  }

  var api = {
    PROFICIENCY_LEVELS: PROFICIENCY_LEVELS,
    nextEditableRowMajor: nextEditableRowMajor,
    nextEditableInDir: nextEditableInDir,
    MIN_VALUE: MIN_VALUE,
    MAX_VALUE: MAX_VALUE,
    levelForValue: levelForValue,
    labelForValue: labelForValue,
    shortForValue: shortForValue,
    colorForValue: colorForValue,
    toNumber: toNumber,
    assignmentScore: assignmentScore,
    categoryAverage: categoryAverage,
    overallGrade: overallGrade
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.GradebookCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
