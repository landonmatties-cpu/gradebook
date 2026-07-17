/*
 * renderer.js — all UI logic for the gradebook.
 * Uses window.api (preload bridge) for persistence and window.GradebookCalc /
 * window.BCCurriculum for logic and templates.
 */
(function () {
  'use strict';

  var calc = window.GradebookCalc;
  var CURR = window.BCCurriculum;

  // ---------------------------------------------------------------- state
  var state = {
    version: 1,
    classes: [],
    ui: { selectedClassId: null, activeTab: 'gradebook' }
  };

  var saveTimer = null;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ---------------------------------------------------------------- persistence
  function load() {
    return window.api.load().then(function (data) {
      if (data && data.classes) {
        state.classes = data.classes;
        state.ui = data.ui || state.ui;
        if (!findClass(state.ui.selectedClassId) && state.classes.length) {
          state.ui.selectedClassId = state.classes[0].id;
        }
      }
      migrate();
      render();
    });
  }

  // Backfill fields added in later versions so old data keeps working.
  function migrate() {
    var base = Date.now();
    state.classes.forEach(function (cls) {
      (cls.assignments || []).forEach(function (a, i) {
        if (!a.createdAt) a.createdAt = base + i;
      });
    });
    if (!state.ui.gradebookSort) state.ui.gradebookSort = 'category';
    if (state.ui.gradingAssignmentId === undefined) state.ui.gradingAssignmentId = null;
  }

  function saveSoon() {
    setStatus('Saving…');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      window.api.save({ version: state.version, classes: state.classes, ui: state.ui })
        .then(function (res) {
          setStatus(res && res.ok ? 'All changes saved' : 'Save error');
        });
    }, 250);
  }

  function setStatus(msg) {
    var el = $('#save-status');
    if (el) el.textContent = msg;
  }

  // ---------------------------------------------------------------- model helpers
  function findClass(id) {
    return state.classes.filter(function (c) { return c.id === id; })[0] || null;
  }
  function currentClass() { return findClass(state.ui.selectedClassId); }

  function assignmentsByCategory(cls) {
    var map = {};
    cls.categories.forEach(function (cat) { map[cat.id] = []; });
    cls.assignments.forEach(function (a) {
      if (!map[a.categoryId]) map[a.categoryId] = [];
      map[a.categoryId].push(a);
    });
    return map;
  }

  // Build { assignmentId: {scores, excused} } for one student.
  function gradesForStudent(cls, studentId) {
    var out = {};
    cls.assignments.forEach(function (a) {
      var g = a.grades && a.grades[studentId];
      if (g) out[a.id] = g;
    });
    return out;
  }

  function studentOverall(cls, studentId) {
    var byCat = assignmentsByCategory(cls);
    var grades = gradesForStudent(cls, studentId);
    return calc.overallGrade(cls.categories, byCat, grades);
  }

  function competencyById(cls, id) {
    return cls.competencies.filter(function (c) { return c.id === id; })[0] || null;
  }

  // ---------------------------------------------------------------- rendering
  function render() {
    renderSidebar();
    renderMain();
  }

  function renderSidebar() {
    var list = $('#class-list');
    list.innerHTML = '';
    if (!state.classes.length) {
      list.innerHTML = '<div class="empty-hint" style="font-size:13px">No classes yet.</div>';
      return;
    }
    state.classes.forEach(function (c) {
      var div = document.createElement('div');
      div.className = 'class-item' + (c.id === state.ui.selectedClassId ? ' active' : '');
      div.innerHTML = '<span class="ci-name">' + esc(c.name) + '</span>' +
        '<span class="ci-sub">' + (c.grade ? 'Gr ' + esc(c.grade) + ' · ' : '') +
        esc(c.subject || 'Custom') + ' · ' + c.students.length + ' students</span>';
      div.addEventListener('click', function () {
        state.ui.selectedClassId = c.id;
        saveSoon();
        render();
      });
      list.appendChild(div);
    });
  }

  function renderMain() {
    var cls = currentClass();
    var empty = $('#main-empty');
    var view = $('#class-view');
    if (!cls) {
      empty.classList.remove('hidden');
      view.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    view.classList.remove('hidden');

    $('#class-title').textContent = cls.name;
    $('#class-subtitle').textContent = (cls.grade ? 'Grade ' + cls.grade + ' · ' : '') +
      (cls.subject || 'Custom subject') + ' · ' +
      cls.students.length + ' students · ' + cls.assignments.length + ' assignments';

    $all('#tabs .tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === state.ui.activeTab);
    });

    renderTab();
  }

  function renderTab() {
    var cls = currentClass();
    var host = $('#tab-content');
    host.innerHTML = '';
    if (!cls) return;
    switch (state.ui.activeTab) {
      case 'gradebook': renderGradebook(host, cls); break;
      case 'assignments': renderAssignments(host, cls); break;
      case 'students': renderStudents(host, cls); break;
      case 'competencies': renderCompetencies(host, cls); break;
    }
  }

  function scaleLegendHTML() {
    var chips = calc.PROFICIENCY_LEVELS.map(function (l) {
      return '<span class="scale-chip"><span class="scale-swatch" style="background:' +
        l.color + '"></span>' + l.value + ' · ' + esc(l.label) + '</span>';
    }).join('');
    return '<div class="scale-legend">' + chips + '</div>';
  }

  // ---------------------------------------------------------------- Gradebook tab
  function startGrading(assignmentId) {
    state.ui.activeTab = 'gradebook';
    state.ui.gradingAssignmentId = assignmentId;
    saveSoon();
    renderMain();
  }

  // Assignments in the order the overview should display them.
  function sortedAssignments(cls) {
    var sort = state.ui.gradebookSort || 'category';
    if (sort === 'date') {
      return cls.assignments.slice().sort(function (a, b) {
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
    }
    // category order (as listed in categories), then date within a category
    var order = {};
    cls.categories.forEach(function (c, i) { order[c.id] = i; });
    return cls.assignments.slice().sort(function (a, b) {
      var oa = order[a.categoryId], ob = order[b.categoryId];
      if (oa === undefined) oa = 999; if (ob === undefined) ob = 999;
      if (oa !== ob) return oa - ob;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function renderGradebook(host, cls) {
    if (!cls.students.length || !cls.assignments.length) {
      state.ui.gradingAssignmentId = null;
      host.innerHTML =
        '<div class="card"><h2>Gradebook</h2>' +
        '<p class="card-sub">' +
        (!cls.students.length ? 'Add students in the <b>Students</b> tab. ' : '') +
        (!cls.assignments.length ? 'Create assignments in the <b>Assignments</b> tab. ' : '') +
        'Then grades will appear here.</p>' +
        '<div class="card-sub">Grade scale — type these numbers when entering grades:</div>' +
        scaleLegendHTML() + '</div>';
      return;
    }

    var grading = state.ui.gradingAssignmentId &&
      cls.assignments.filter(function (a) { return a.id === state.ui.gradingAssignmentId; })[0];

    // Control bar: pick an assignment to grade, or choose overview sort.
    var picker = '<label style="font-size:13px;font-weight:600;margin-right:6px">Grade:</label>' +
      '<select id="gb-picker" style="width:auto;min-width:260px;display:inline-block">' +
      '<option value="">— Overview (all assignments) —</option>' +
      cls.categories.map(function (cat) {
        var list = cls.assignments.filter(function (a) { return a.categoryId === cat.id; });
        if (!list.length) return '';
        return '<optgroup label="' + esc(cat.name) + '">' + list.map(function (a) {
          var sel = grading && grading.id === a.id ? ' selected' : '';
          return '<option value="' + a.id + '"' + sel + '>' + esc(a.title) + '</option>';
        }).join('') + '</optgroup>';
      }).join('') + '</select>';

    var sortCtl = grading ? '' :
      '<span style="margin-left:auto"><label style="font-size:13px;font-weight:600;margin-right:6px">Order by:</label>' +
      '<select id="gb-sort" style="width:auto;display:inline-block">' +
      '<option value="category"' + (state.ui.gradebookSort === 'category' ? ' selected' : '') + '>Category</option>' +
      '<option value="date"' + (state.ui.gradebookSort === 'date' ? ' selected' : '') + '>Date created</option>' +
      '</select></span>';

    var bar = '<div class="section-head" style="gap:12px;align-items:center">' +
      '<div style="display:flex;align-items:center;gap:8px;flex:1">' + picker + '</div>' + sortCtl + '</div>';

    host.innerHTML = bar + '<div id="gb-body"></div>';

    $('#gb-picker', host).addEventListener('change', function () {
      state.ui.gradingAssignmentId = this.value || null;
      saveSoon(); renderMain();
    });
    if (!grading) {
      $('#gb-sort', host).addEventListener('change', function () {
        state.ui.gradebookSort = this.value; saveSoon(); renderMain();
      });
    }

    var body = $('#gb-body', host);
    if (grading) renderGradingGrid(body, cls, grading);
    else renderOverviewGrid(body, cls);
  }

  // -- Overview: read-only grid of every assignment's overall per student --
  function renderOverviewGrid(host, cls) {
    var sort = state.ui.gradebookSort || 'category';
    var list = sortedAssignments(cls);

    var headRows;
    if (sort === 'category') {
      var byCat = assignmentsByCategory(cls);
      var catCells = '<th class="student-col" rowspan="2">Student</th>';
      var asgCells = '';
      cls.categories.forEach(function (cat) {
        var l = byCat[cat.id] || [];
        l.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
        if (!l.length) return;
        catCells += '<th class="cat-header" colspan="' + l.length + '">' +
          esc(cat.name) + ' <span class="muted">(' + cat.weight + '%)</span></th>';
        l.forEach(function (a) { asgCells += overviewHeadCell(a); });
      });
      catCells += '<th class="overall-col" rowspan="2">Overall</th>';
      headRows = '<tr>' + catCells + '</tr><tr>' + asgCells + '</tr>';
    } else {
      var cells = '<th class="student-col">Student</th>';
      list.forEach(function (a) { cells += overviewHeadCell(a, true); });
      cells += '<th class="overall-col">Overall</th>';
      headRows = '<tr>' + cells + '</tr>';
    }

    var body = '';
    cls.students.forEach(function (stu) {
      var row = '<td class="student-col">' + esc(stu.name) + '</td>';
      list.forEach(function (a) { row += gradeCellHTML(a, stu); });
      var ov = studentOverall(cls, stu.id);
      row += '<td class="grade-cell overall-col">' + overallPillHTML(ov.value) + '</td>';
      body += '<tr>' + row + '</tr>';
    });

    host.innerHTML =
      '<div class="muted" style="font-size:12px;margin-bottom:8px">Click any assignment column to grade it. ' +
      'Change “Order by” to sort columns by category or by date created.</div>' +
      '<div class="gradebook-wrap"><table class="gradebook">' +
      '<thead>' + headRows + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card" style="margin-top:16px"><div class="card-sub">Grade scale</div>' +
      scaleLegendHTML() + '</div>';

    $all('[data-grade-assignment]', host).forEach(function (el) {
      el.addEventListener('click', function () { startGrading(el.dataset.gradeAssignment); });
    });
    $all('[data-cell]', host).forEach(function (el) {
      el.addEventListener('click', function () { startGrading(el.dataset.assignment); });
    });
  }

  function overviewHeadCell(a, withCat) {
    return '<th class="assignment-head">' +
      '<span class="ah-title" data-grade-assignment="' + a.id + '">' + esc(a.title) + '</span>' +
      '<span class="ah-meta">' + (withCat ? esc(catNameFor(a)) + ' · ' : '') +
      a.competencies.length + ' comp' + (a.competencies.length === 1 ? '' : 's') + '</span></th>';
  }
  function catNameFor(a) {
    var cls = currentClass();
    var c = cls.categories.filter(function (x) { return x.id === a.categoryId; })[0];
    return c ? c.name : '';
  }

  // -- Grading grid: spreadsheet-style, keyboard-navigable, live-saving --
  function renderGradingGrid(host, cls, a) {
    a.grades = a.grades || {};
    var comps = a.competencies;

    var heads = comps.map(function (ac, ci) {
      var c = competencyById(cls, ac.competencyId);
      return '<th title="' + esc(c ? c.name : '') + '">' +
        esc(truncate(c ? c.name : '(removed)', 22)) +
        '<div class="ah-meta">weight ' + ac.weight + '</div></th>';
    }).join('');

    var rows = cls.students.map(function (stu, ri) {
      var g = a.grades[stu.id] || { scores: {}, excused: false };
      var cells = comps.map(function (ac, ci) {
        var v = g.scores ? g.scores[ac.competencyId] : null;
        return '<td style="text-align:center"><input type="number" min="1" max="8" step="1" ' +
          'class="num-input grade-input" data-r="' + ri + '" data-c="' + ci + '" ' +
          'data-student="' + stu.id + '" data-comp="' + ac.competencyId + '" ' +
          'value="' + (v == null ? '' : v) + '"' + (g.excused ? ' disabled' : '') + ' placeholder="—"></td>';
      }).join('');
      return '<tr data-row="' + stu.id + '"><td class="student-col">' + esc(stu.name) + '</td>' +
        cells +
        '<td style="text-align:center" class="ga-overall" data-overall="' + stu.id + '"></td>' +
        '<td style="text-align:center"><input type="checkbox" class="ga-excuse" data-student="' + stu.id + '"' +
        (g.excused ? ' checked' : '') + '></td></tr>';
    }).join('');

    host.innerHTML =
      '<div class="section-head" style="margin-bottom:8px"><div>' +
      '<h2 style="margin:0">Grading: ' + esc(a.title) + '</h2>' +
      '<div class="card-sub" style="margin:2px 0 0">Type a number 1–8 in each cell. ' +
      '<b>Enter</b> or <b>↓</b> moves down · <b>Tab</b> moves across · saves automatically.</div></div>' +
      '<button class="btn btn-sm" id="gg-done">← Back to overview</button></div>' +
      '<div class="gradebook-wrap"><table class="gradebook grade-assignment-table">' +
      '<thead><tr><th class="student-col">Student</th>' + heads +
      '<th>Overall</th><th>Excuse</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="card" style="margin-top:16px"><div class="card-sub">Grade scale</div>' +
      scaleLegendHTML() + '</div>';

    var nRows = cls.students.length;
    var nCols = comps.length;

    function inputAt(r, c) {
      return host.querySelector('.grade-input[data-r="' + r + '"][data-c="' + c + '"]');
    }
    function focusCell(r, c) {
      if (r < 0 || r >= nRows || c < 0 || c >= nCols) return;
      var el = inputAt(r, c);
      // skip disabled (excused) rows in the same direction of travel
      var guard = 0;
      while (el && el.disabled && guard < nRows) { r += 1; el = inputAt(r, c); guard++; }
      if (el && !el.disabled) { el.focus(); el.select(); }
    }
    function readScores(sid) {
      var out = {};
      $all('.grade-input[data-student="' + sid + '"]', host).forEach(function (inp) {
        var n = calc.toNumber(inp.value);
        if (n !== null) out[inp.dataset.comp] = n;
      });
      return out;
    }
    function persist(sid) {
      var exc = $('.ga-excuse[data-student="' + sid + '"]', host).checked;
      var sc = readScores(sid);
      if (exc) a.grades[sid] = { scores: sc, excused: true };
      else if (Object.keys(sc).length === 0) delete a.grades[sid];
      else a.grades[sid] = { scores: sc, excused: false };
      var cell = $('.ga-overall[data-overall="' + sid + '"]', host);
      if (exc) cell.innerHTML = '<span class="grade-excused">Excused</span>';
      else cell.innerHTML = gradePillHTML(calc.assignmentScore(a, sc));
      saveSoon();
    }

    $all('.grade-input', host).forEach(function (inp) {
      inp.addEventListener('focus', function () { inp.select(); });
      inp.addEventListener('input', function () { persist(inp.dataset.student); });
      inp.addEventListener('change', function () {
        // normalize the displayed value to the stored (clamped) one
        var n = calc.toNumber(inp.value);
        inp.value = n == null ? '' : n;
        persist(inp.dataset.student);
      });
      inp.addEventListener('keydown', function (e) {
        var r = Number(inp.dataset.r), c = Number(inp.dataset.c);
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(r + 1, c); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(r - 1, c); }
      });
    });
    $all('.ga-excuse', host).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var sid = cb.dataset.student;
        $all('.grade-input[data-student="' + sid + '"]', host).forEach(function (inp) { inp.disabled = cb.checked; });
        persist(sid);
      });
    });
    // initialize overall cells + focus first editable cell
    cls.students.forEach(function (stu) {
      var cell = $('.ga-overall[data-overall="' + stu.id + '"]', host);
      var g = a.grades[stu.id];
      if (g && g.excused) cell.innerHTML = '<span class="grade-excused">Excused</span>';
      else cell.innerHTML = gradePillHTML(calc.assignmentScore(a, g ? g.scores : null));
    });
    $('#gg-done', host).addEventListener('click', function () {
      state.ui.gradingAssignmentId = null; saveSoon(); renderMain();
    });
    if (nCols > 0) focusCell(0, 0);
  }

  function gradeCellHTML(assignment, student) {
    var g = assignment.grades && assignment.grades[student.id];
    var inner;
    if (g && g.excused) {
      inner = '<span class="grade-excused">Excused</span>';
    } else {
      var score = calc.assignmentScore(assignment, g ? g.scores : null);
      inner = gradePillHTML(score);
    }
    return '<td class="grade-cell" data-cell="1" data-assignment="' + assignment.id +
      '" data-student="' + student.id + '">' + inner + '</td>';
  }

  function gradePillHTML(score) {
    if (score === null || score === undefined) {
      return '<span class="grade-pill empty">—</span>';
    }
    var lvl = calc.levelForValue(score);
    return '<span class="grade-pill" style="background:' + calc.colorForValue(score) +
      '" title="' + esc(lvl.label) + ' (' + score.toFixed(2) + ')">' +
      lvl.short + '</span>';
  }

  function overallPillHTML(value) {
    if (value === null || value === undefined) return '<span class="grade-pill empty">—</span>';
    var lvl = calc.levelForValue(value);
    return '<span class="grade-pill overall-pill" style="background:' + calc.colorForValue(value) +
      '" title="' + esc(lvl.label) + ' (' + value.toFixed(2) + ')">' +
      lvl.short + ' · ' + value.toFixed(1) + '</span>';
  }

  // ---------------------------------------------------------------- Assignments tab
  function renderAssignments(host, cls) {
    var byCat = assignmentsByCategory(cls);
    var totalWeight = cls.categories.reduce(function (s, c) { return s + (Number(c.weight) || 0); }, 0);

    // Categories card
    var catRows = cls.categories.map(function (cat) {
      return '<tr><td>' + esc(cat.name) + '</td>' +
        '<td style="width:120px"><input type="number" min="0" class="cat-weight" data-cat="' + cat.id +
        '" value="' + (Number(cat.weight) || 0) + '" style="width:90px"> %</td>' +
        '<td style="width:90px"><div class="row-actions">' +
        '<button class="btn btn-sm btn-ghost" data-rename-cat="' + cat.id + '">Rename</button>' +
        '<button class="btn btn-sm btn-ghost danger" data-del-cat="' + cat.id + '">✕</button>' +
        '</div></td></tr>';
    }).join('');

    var catCard = '<div class="card"><div class="section-head"><div>' +
      '<h2>Categories &amp; weights</h2>' +
      '<div class="card-sub">Each category counts toward the overall grade by its weight. ' +
      'Weights are relative — they don\'t have to add to 100.</div></div>' +
      '<span class="pill-total ' + (totalWeight === 100 ? '' : '') + '">Total: ' + totalWeight + '%</span>' +
      '</div>' +
      (cls.categories.length ?
        '<div class="table-wrap"><table class="data"><thead><tr><th>Category</th><th>Weight</th><th></th></tr></thead>' +
        '<tbody>' + catRows + '</tbody></table></div>' :
        '<div class="empty-hint">No categories yet.</div>') +
      '<div style="margin-top:12px"><button class="btn btn-sm" id="add-cat-btn">+ Add category</button></div>' +
      '</div>';

    // Assignments card
    var asgSections = cls.categories.map(function (cat) {
      var list = byCat[cat.id] || [];
      if (!list.length) return '';
      var rows = list.map(function (a) {
        var comps = a.competencies.map(function (ac) {
          var c = competencyById(cls, ac.competencyId);
          return '<span class="tag">' + esc(c ? c.name : '(removed)') + ' · w' + ac.weight + '</span>';
        }).join(' ');
        return '<tr><td><b>' + esc(a.title) + '</b><div style="margin-top:4px">' + comps + '</div></td>' +
          '<td style="width:150px"><div class="row-actions">' +
          '<button class="btn btn-sm btn-ghost" data-edit-asg="' + a.id + '">Edit</button>' +
          '<button class="btn btn-sm" data-grade-asg="' + a.id + '">Grade</button>' +
          '<button class="btn btn-sm btn-ghost danger" data-del-asg="' + a.id + '">✕</button>' +
          '</div></td></tr>';
      }).join('');
      return '<h3 style="margin:16px 0 6px;font-size:14px">' + esc(cat.name) + '</h3>' +
        '<div class="table-wrap"><table class="data"><tbody>' + rows + '</tbody></table></div>';
    }).join('');

    var asgCard = '<div class="card"><div class="section-head">' +
      '<div><h2>Assignments</h2><div class="card-sub">Title + curricular competencies with weights. ' +
      'The overall assignment grade is generated automatically from the competency grades.</div></div>' +
      '<button class="btn btn-primary btn-sm" id="add-asg-btn"' +
      (cls.categories.length ? '' : ' disabled title="Add a category first"') + '>+ New assignment</button>' +
      '</div>' +
      (cls.assignments.length ? asgSections : '<div class="empty-hint">No assignments yet.</div>') +
      '</div>';

    host.innerHTML = catCard + asgCard;

    // wire categories
    $('#add-cat-btn').addEventListener('click', function () {
      promptText('New category', 'Category name', '', function (name) {
        if (!name) return;
        cls.categories.push({ id: uid(), name: name, weight: 0 });
        saveSoon(); renderTab();
      });
    });
    $all('.cat-weight', host).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var cat = cls.categories.filter(function (c) { return c.id === inp.dataset.cat; })[0];
        if (cat) { cat.weight = Math.max(0, Number(inp.value) || 0); saveSoon(); renderTab(); }
      });
    });
    $all('[data-rename-cat]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var cat = cls.categories.filter(function (c) { return c.id === b.dataset.renameCat; })[0];
        promptText('Rename category', 'Category name', cat.name, function (name) {
          if (name) { cat.name = name; saveSoon(); renderTab(); }
        });
      });
    });
    $all('[data-del-cat]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var cat = cls.categories.filter(function (c) { return c.id === b.dataset.delCat; })[0];
        var count = cls.assignments.filter(function (a) { return a.categoryId === cat.id; }).length;
        confirmModal('Delete category?',
          'Delete "' + esc(cat.name) + '"' + (count ? ' and its ' + count + ' assignment(s)' : '') + '? This cannot be undone.',
          function () {
            cls.assignments = cls.assignments.filter(function (a) { return a.categoryId !== cat.id; });
            cls.categories = cls.categories.filter(function (c) { return c.id !== cat.id; });
            saveSoon(); renderTab();
          });
      });
    });

    // wire assignments
    var addAsg = $('#add-asg-btn');
    if (addAsg && cls.categories.length) {
      addAsg.addEventListener('click', function () { openAssignmentModal(cls, null); });
    }
    $all('[data-edit-asg]', host).forEach(function (b) {
      b.addEventListener('click', function () { openAssignmentModal(cls, b.dataset.editAsg); });
    });
    $all('[data-grade-asg]', host).forEach(function (b) {
      b.addEventListener('click', function () { startGrading(b.dataset.gradeAsg); });
    });
    $all('[data-del-asg]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var a = cls.assignments.filter(function (x) { return x.id === b.dataset.delAsg; })[0];
        confirmModal('Delete assignment?', 'Delete "' + esc(a.title) + '" and all its grades?', function () {
          cls.assignments = cls.assignments.filter(function (x) { return x.id !== a.id; });
          saveSoon(); renderTab();
        });
      });
    });
  }

  // ---------------------------------------------------------------- Students tab
  function renderStudents(host, cls) {
    var rows = cls.students.map(function (s, i) {
      return '<tr><td style="width:40px">' + (i + 1) + '</td><td>' + esc(s.name) + '</td>' +
        '<td style="width:130px"><div class="row-actions">' +
        '<button class="btn btn-sm btn-ghost" data-rename-stu="' + s.id + '">Rename</button>' +
        '<button class="btn btn-sm btn-ghost danger" data-del-stu="' + s.id + '">✕</button>' +
        '</div></td></tr>';
    }).join('');

    host.innerHTML = '<div class="card"><div class="section-head">' +
      '<div><h2>Students</h2><div class="card-sub">' + cls.students.length + ' students on the roster</div></div>' +
      '<button class="btn btn-primary btn-sm" id="add-students-btn">+ Add students</button></div>' +
      (cls.students.length ?
        '<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Name</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' :
        '<div class="empty-hint">No students yet. Add them one per line.</div>') +
      '</div>';

    $('#add-students-btn').addEventListener('click', function () {
      openTextareaModal('Add students', 'Enter one student name per line:', '', function (text) {
        text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (name) {
          cls.students.push({ id: uid(), name: name });
        });
        saveSoon(); renderTab();
      });
    });
    $all('[data-rename-stu]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var s = cls.students.filter(function (x) { return x.id === b.dataset.renameStu; })[0];
        promptText('Rename student', 'Name', s.name, function (name) {
          if (name) { s.name = name; saveSoon(); renderTab(); }
        });
      });
    });
    $all('[data-del-stu]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var s = cls.students.filter(function (x) { return x.id === b.dataset.delStu; })[0];
        confirmModal('Remove student?', 'Remove "' + esc(s.name) + '" and their grades from this class?', function () {
          cls.students = cls.students.filter(function (x) { return x.id !== s.id; });
          cls.assignments.forEach(function (a) { if (a.grades) delete a.grades[s.id]; });
          saveSoon(); renderTab();
        });
      });
    });
  }

  // ---------------------------------------------------------------- Competencies tab
  function renderCompetencies(host, cls) {
    var byArea = {};
    cls.competencies.forEach(function (c) {
      var a = c.area || 'General';
      (byArea[a] = byArea[a] || []).push(c);
    });
    var sections = Object.keys(byArea).map(function (area) {
      var rows = byArea[area].map(function (c) {
        return '<tr><td>' + esc(c.name) + '</td>' +
          '<td style="width:130px"><div class="row-actions">' +
          '<button class="btn btn-sm btn-ghost" data-edit-comp="' + c.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-ghost danger" data-del-comp="' + c.id + '">✕</button>' +
          '</div></td></tr>';
      }).join('');
      return '<h3 style="margin:14px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted)">' +
        esc(area) + '</h3><div class="table-wrap"><table class="data"><tbody>' + rows + '</tbody></table></div>';
    }).join('');

    host.innerHTML = '<div class="card"><div class="section-head">' +
      '<div><h2>Curricular competencies</h2><div class="card-sub">These appear in the dropdown when you build an assignment. ' +
      'Pre-filled from the BC curriculum — edit freely.</div></div>' +
      '<button class="btn btn-primary btn-sm" id="add-comp-btn">+ Add competency</button></div>' +
      (cls.competencies.length ? sections : '<div class="empty-hint">No competencies yet.</div>') +
      '</div>';

    $('#add-comp-btn').addEventListener('click', function () {
      openCompetencyModal(cls, null);
    });
    $all('[data-edit-comp]', host).forEach(function (b) {
      b.addEventListener('click', function () { openCompetencyModal(cls, b.dataset.editComp); });
    });
    $all('[data-del-comp]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = cls.competencies.filter(function (x) { return x.id === b.dataset.delComp; })[0];
        var used = cls.assignments.some(function (a) {
          return a.competencies.some(function (ac) { return ac.competencyId === c.id; });
        });
        confirmModal('Delete competency?',
          'Delete "' + esc(c.name) + '"?' + (used ? ' It is used by one or more assignments; those references will be removed.' : ''),
          function () {
            cls.competencies = cls.competencies.filter(function (x) { return x.id !== c.id; });
            cls.assignments.forEach(function (a) {
              a.competencies = a.competencies.filter(function (ac) { return ac.competencyId !== c.id; });
              if (a.grades) Object.keys(a.grades).forEach(function (sid) {
                if (a.grades[sid].scores) delete a.grades[sid].scores[c.id];
              });
            });
            saveSoon(); renderTab();
          });
      });
    });
  }

  // ---------------------------------------------------------------- Modals: infra
  function openModal(html, opts) {
    opts = opts || {};
    var root = $('#modal-root');
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '">' + html + '</div>';
    root.appendChild(backdrop);
    backdrop.addEventListener('mousedown', function (e) {
      if (e.target === backdrop && !opts.noBackdropClose) close();
    });
    function close() { root.removeChild(backdrop); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    return { el: backdrop, close: close };
  }

  function promptText(title, label, value, cb) {
    var m = openModal(
      '<h2>' + esc(title) + '</h2>' +
      '<div class="form-row"><label>' + esc(label) + '</label>' +
      '<input type="text" id="pt-input" value="' + esc(value) + '"></div>' +
      '<div class="modal-actions"><button class="btn" id="pt-cancel">Cancel</button>' +
      '<button class="btn btn-primary" id="pt-ok">Save</button></div>');
    var inp = $('#pt-input', m.el);
    inp.focus(); inp.select();
    $('#pt-cancel', m.el).addEventListener('click', m.close);
    function done() { var v = inp.value.trim(); m.close(); cb(v); }
    $('#pt-ok', m.el).addEventListener('click', done);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(); });
  }

  function openTextareaModal(title, label, value, cb) {
    var m = openModal(
      '<h2>' + esc(title) + '</h2>' +
      '<div class="form-row"><label>' + esc(label) + '</label>' +
      '<textarea id="ta-input" rows="8">' + esc(value) + '</textarea></div>' +
      '<div class="modal-actions"><button class="btn" id="ta-cancel">Cancel</button>' +
      '<button class="btn btn-primary" id="ta-ok">Add</button></div>');
    var inp = $('#ta-input', m.el); inp.focus();
    $('#ta-cancel', m.el).addEventListener('click', m.close);
    $('#ta-ok', m.el).addEventListener('click', function () { var v = inp.value; m.close(); cb(v); });
  }

  function confirmModal(title, msg, cb, opts) {
    opts = opts || {};
    var okLabel = opts.okLabel || 'Delete';
    var okClass = opts.okClass || 'danger';
    var m = openModal(
      '<h2>' + esc(title) + '</h2><p class="modal-sub">' + msg + '</p>' +
      '<div class="modal-actions"><button class="btn" id="cf-cancel">Cancel</button>' +
      '<button class="btn ' + okClass + '" id="cf-ok">' + esc(okLabel) + '</button></div>');
    $('#cf-cancel', m.el).addEventListener('click', m.close);
    $('#cf-ok', m.el).addEventListener('click', function () { m.close(); cb(); });
  }

  // ---------------------------------------------------------------- Modal: class
  function openClassModal(existing) {
    var isEdit = !!existing;
    var templateOptions = CURR.SUBJECT_TEMPLATES.map(function (t) {
      return '<option value="' + t.id + '">' + esc(t.name) + '</option>';
    }).join('');

    var html = '<h2>' + (isEdit ? 'Edit class' : 'Add a class') + '</h2>' +
      '<p class="modal-sub">Give this class a name — you can add several classes of the same ' +
      'subject (e.g. "Math 8 — Block A" and "Math 8 — Block D").</p>' +
      '<div class="form-row"><label>Class name</label>' +
      '<input type="text" id="cm-name" placeholder="e.g. Math 8 — Block A" value="' +
      esc(isEdit ? existing.name : '') + '"></div>';

    var gradeOptions = CURR.GRADES.map(function (g) {
      return '<option value="' + g + '">Grade ' + g + '</option>';
    }).join('');

    if (isEdit) {
      html += '<div class="inline-fields">' +
        '<div class="form-row"><label>Grade</label><select id="cm-grade">' +
        '<option value="">—</option>' + gradeOptions + '</select></div>' +
        '<div class="form-row" style="flex:2"><label>Subject label</label>' +
        '<input type="text" id="cm-subject" value="' + esc(existing.subject || '') + '"></div></div>';
    } else {
      html += '<div class="inline-fields">' +
        '<div class="form-row"><label>Grade</label><select id="cm-grade">' +
        '<option value="">—</option>' + gradeOptions + '</select></div>' +
        '<div class="form-row" style="flex:2"><label>Start from a BC subject ' +
        '<span class="hint">pre-fills competencies &amp; categories</span></label>' +
        '<select id="cm-template"><option value="">Blank (fully custom)</option>' + templateOptions + '</select></div></div>' +
        '<div class="form-row"><label>Subject label <span class="hint">optional override</span></label>' +
        '<input type="text" id="cm-subject" placeholder="auto-filled from subject"></div>' +
        '<div id="cm-preview" class="live-overall" style="display:none"></div>';
    }

    html += '<div class="modal-actions"><button class="btn" id="cm-cancel">Cancel</button>' +
      '<button class="btn btn-primary" id="cm-save">' + (isEdit ? 'Save' : 'Create class') + '</button></div>';

    var m = openModal(html);
    var nameInp = $('#cm-name', m.el); nameInp.focus();
    var tplSel = $('#cm-template', m.el);
    var subjInp = $('#cm-subject', m.el);
    var gradeSel = $('#cm-grade', m.el);
    var preview = $('#cm-preview', m.el);
    if (isEdit && existing.grade) gradeSel.value = existing.grade;

    function refreshPreview() {
      if (!preview || !tplSel) return;
      var t = CURR.templateById(tplSel.value);
      subjInp.placeholder = t ? t.name : 'auto-filled from subject';
      if (!t) { preview.style.display = 'none'; return; }
      var comps = CURR.competenciesFor(t, gradeSel.value);
      var contentCount = comps.filter(function (c) { return /Content$/.test(c.area || ''); }).length;
      preview.style.display = 'block';
      preview.innerHTML = 'This will add <b>' + comps.length + '</b> competencies' +
        (gradeSel.value && contentCount ? ' (including <b>' + contentCount + '</b> Grade ' + gradeSel.value + ' content topics)' :
          (t.contentByGrade ? ' — <span class="muted">pick a grade to include grade-specific content topics</span>' : '')) +
        ' and ' + CURR.DEFAULT_CATEGORIES.length + ' default categories.';
    }
    if (tplSel) { tplSel.addEventListener('change', refreshPreview); gradeSel.addEventListener('change', refreshPreview); }

    $('#cm-cancel', m.el).addEventListener('click', m.close);
    $('#cm-save', m.el).addEventListener('click', function () {
      var name = nameInp.value.trim();
      if (!name) { nameInp.focus(); return; }
      var grade = gradeSel.value;
      if (isEdit) {
        existing.name = name;
        existing.subject = subjInp.value.trim();
        existing.grade = grade;
      } else {
        var tpl = CURR.templateById(tplSel.value);
        var subject = subjInp.value.trim() || (tpl ? tpl.name : 'Custom');
        var cls = {
          id: uid(),
          name: name,
          grade: grade,
          subject: subject,
          students: [],
          competencies: tpl ? CURR.competenciesFor(tpl, grade).map(function (c) {
            return { id: uid(), name: c.name, area: c.area };
          }) : [],
          categories: (tpl ? CURR.DEFAULT_CATEGORIES : []).map(function (c) {
            return { id: uid(), name: c.name, weight: c.weight };
          }),
          assignments: []
        };
        state.classes.push(cls);
        state.ui.selectedClassId = cls.id;
      }
      m.close(); saveSoon(); render();
    });
  }

  // ---------------------------------------------------------------- Modal: competency
  function openCompetencyModal(cls, id) {
    var existing = id ? competencyById(cls, id) : null;
    var m = openModal(
      '<h2>' + (existing ? 'Edit' : 'Add') + ' competency</h2>' +
      '<div class="form-row"><label>Competency</label>' +
      '<textarea id="co-name" rows="2">' + esc(existing ? existing.name : '') + '</textarea></div>' +
      '<div class="form-row"><label>Area / grouping <span class="hint">optional</span></label>' +
      '<input type="text" id="co-area" value="' + esc(existing ? existing.area : '') + '" placeholder="e.g. Comprehend & Connect"></div>' +
      '<div class="modal-actions"><button class="btn" id="co-cancel">Cancel</button>' +
      '<button class="btn btn-primary" id="co-save">Save</button></div>');
    $('#co-name', m.el).focus();
    $('#co-cancel', m.el).addEventListener('click', m.close);
    $('#co-save', m.el).addEventListener('click', function () {
      var name = $('#co-name', m.el).value.trim();
      var area = $('#co-area', m.el).value.trim();
      if (!name) return;
      if (existing) { existing.name = name; existing.area = area; }
      else { cls.competencies.push({ id: uid(), name: name, area: area }); }
      m.close(); saveSoon(); renderTab();
    });
  }

  // ---------------------------------------------------------------- Modal: assignment
  function openAssignmentModal(cls, id) {
    var existing = id ? cls.assignments.filter(function (a) { return a.id === id; })[0] : null;
    var selected = {}; // competencyId -> weight
    if (existing) existing.competencies.forEach(function (ac) { selected[ac.competencyId] = ac.weight; });

    var catOptions = cls.categories.map(function (c) {
      var sel = existing && existing.categoryId === c.id ? ' selected' : '';
      return '<option value="' + c.id + '"' + sel + '>' + esc(c.name) + '</option>';
    }).join('');

    var compRows = cls.competencies.map(function (c) {
      var isSel = selected.hasOwnProperty(c.id);
      var w = isSel ? selected[c.id] : 1;
      return '<div class="comp-pick-row">' +
        '<input type="checkbox" data-comp="' + c.id + '"' + (isSel ? ' checked' : '') + '>' +
        '<div class="cp-main"><div>' + esc(c.name) + '</div>' +
        (c.area ? '<div class="cp-area">' + esc(c.area) + '</div>' : '') + '</div>' +
        '<label class="weight-badge">weight <input type="number" min="0" step="1" class="cp-weight num-input" ' +
        'data-comp-weight="' + c.id + '" value="' + w + '" style="width:64px"' + (isSel ? '' : ' disabled') + '></label>' +
        '</div>';
    }).join('');

    var html = '<h2>' + (existing ? 'Edit assignment' : 'New assignment') + '</h2>' +
      '<p class="modal-sub">Just a title and the curricular competencies it assesses. ' +
      'Set a weight for each competency; the overall assignment grade is generated from them automatically.</p>' +
      '<div class="inline-fields">' +
      '<div class="form-row" style="flex:2"><label>Title</label>' +
      '<input type="text" id="as-title" placeholder="e.g. Fractions Quiz" value="' + esc(existing ? existing.title : '') + '"></div>' +
      '<div class="form-row" style="flex:1"><label>Category</label><select id="as-cat">' + catOptions + '</select></div>' +
      '</div>' +
      '<div class="form-row"><label>Curricular competencies <span class="hint">check the ones this assignment addresses</span></label>' +
      (cls.competencies.length ?
        '<div class="comp-picker">' + compRows + '</div>' :
        '<div class="warn">This class has no competencies yet. Add some in the Competencies tab first.</div>') +
      '<div id="as-warn" class="warn"></div></div>' +
      '<div class="modal-actions"><button class="btn" id="as-cancel">Cancel</button>' +
      '<button class="btn btn-primary" id="as-save">' + (existing ? 'Save' : 'Create') + '</button></div>';

    var m = openModal(html, { wide: true });
    $('#as-title', m.el).focus();

    // enable/disable weight inputs with checkbox
    $all('[data-comp]', m.el).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var wInp = $('[data-comp-weight="' + cb.dataset.comp + '"]', m.el);
        wInp.disabled = !cb.checked;
      });
    });

    $('#as-cancel', m.el).addEventListener('click', m.close);
    $('#as-save', m.el).addEventListener('click', function () {
      var title = $('#as-title', m.el).value.trim();
      var warn = $('#as-warn', m.el);
      if (!title) { warn.textContent = 'Please enter a title.'; return; }
      var comps = [];
      $all('[data-comp]', m.el).forEach(function (cb) {
        if (cb.checked) {
          var w = Number($('[data-comp-weight="' + cb.dataset.comp + '"]', m.el).value) || 0;
          comps.push({ competencyId: cb.dataset.comp, weight: Math.max(0, w) });
        }
      });
      if (!comps.length) { warn.textContent = 'Select at least one competency.'; return; }
      if (!comps.some(function (c) { return c.weight > 0; })) {
        warn.textContent = 'At least one competency needs a weight above 0.'; return;
      }
      var catId = $('#as-cat', m.el).value;
      if (existing) {
        existing.title = title;
        existing.categoryId = catId;
        existing.competencies = comps;
        // drop grades for competencies no longer part of the assignment
        var keep = {}; comps.forEach(function (c) { keep[c.competencyId] = true; });
        if (existing.grades) Object.keys(existing.grades).forEach(function (sid) {
          var sc = existing.grades[sid].scores || {};
          Object.keys(sc).forEach(function (cid) { if (!keep[cid]) delete sc[cid]; });
        });
      } else {
        cls.assignments.push({
          id: uid(), title: title, categoryId: catId, competencies: comps, grades: {},
          createdAt: Date.now()
        });
      }
      m.close(); saveSoon(); renderTab();
    });
  }

  function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // ---------------------------------------------------------------- top-level wiring
  function wireChrome() {
    $('#add-class-btn').addEventListener('click', function () { openClassModal(null); });
    $('#empty-add-class').addEventListener('click', function () { openClassModal(null); });
    $('#edit-class-btn').addEventListener('click', function () {
      var c = currentClass(); if (c) openClassModal(c);
    });
    $('#delete-class-btn').addEventListener('click', function () {
      var c = currentClass(); if (!c) return;
      confirmModal('Delete class?', 'Delete "' + esc(c.name) + '" and all its data? This cannot be undone.', function () {
        state.classes = state.classes.filter(function (x) { return x.id !== c.id; });
        state.ui.selectedClassId = state.classes.length ? state.classes[0].id : null;
        saveSoon(); render();
      });
    });
    $all('#tabs .tab').forEach(function (t) {
      t.addEventListener('click', function () {
        state.ui.activeTab = t.dataset.tab; saveSoon(); renderMain();
      });
    });
    $('#export-btn').addEventListener('click', function () {
      window.api.exportData({ version: state.version, classes: state.classes, ui: state.ui }).then(function (r) {
        if (r && r.ok) setStatus('Exported backup');
      });
    });
    $('#import-btn').addEventListener('click', function () {
      confirmModal('Import backup?', 'Importing replaces all current classes with the contents of the backup file. Continue?', function () {
        window.api.importData().then(function (r) {
          if (r && r.ok && r.data && r.data.classes) {
            state.classes = r.data.classes;
            state.ui.selectedClassId = state.classes.length ? state.classes[0].id : null;
            saveSoon(); render(); setStatus('Imported backup');
          }
        });
      }, { okLabel: 'Choose file…', okClass: 'btn-primary' });
    });
  }

  // ---------------------------------------------------------------- boot
  wireChrome();
  load();
})();
