/*
 * renderer.js — all UI logic for the gradebook.
 *
 * Data model:
 *   Class   { id, name, grade, students:[{id,name}], subjects:[Subject] }
 *   Subject { id, name, competencies:[{id,name,area}], categories:[{id,name,weight}],
 *             assignments:[{ id, title, categoryId, createdAt,
 *                            competencies:[{competencyId,weight}],
 *                            grades:{ [studentId]:{scores:{compId:n}, excused} } }] }
 *
 * A class owns the student roster; each subject the teacher teaches that class
 * is a course with its own competencies, categories, assignments and grades.
 */
(function () {
  'use strict';

  var calc = window.GradebookCalc;
  var CURR = window.BCCurriculum;

  var state = {
    version: 2,
    classes: [],
    ui: {
      selectedClassId: null,
      classTab: null,          // 'summary' | 'students' | <subjectId>
      subjectTab: 'gradebook', // gradebook | report | assignments | competencies
      gradebookSort: 'category',
      expandedAssignments: {},
      theme: 'light'
    }
  };

  var saveTimer = null;
  var pendingGradeFocus = false;

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
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
        state.ui = Object.assign(state.ui, data.ui || {});
      }
      migrate();
      applyTheme();
      render();
    });
  }

  function saveSoon() {
    setStatus('Saving…');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      window.api.save({ version: state.version, classes: state.classes, ui: state.ui })
        .then(function (res) { setStatus(res && res.ok ? 'All changes saved' : 'Save error'); });
    }, 250);
  }
  function setStatus(msg) { var el = $('#save-status'); if (el) el.textContent = msg; }

  // Migrate older data (v1: class == single subject) into the class/subjects model.
  function migrate() {
    state.classes.forEach(function (cls) {
      if (!cls.subjects) {
        cls.subjects = [{
          id: uid(),
          name: cls.subject || 'Subject',
          competencies: cls.competencies || [],
          categories: cls.categories || [],
          assignments: cls.assignments || []
        }];
        delete cls.subject; delete cls.competencies; delete cls.categories; delete cls.assignments;
      }
      cls.students = cls.students || [];
      var base = Date.now();
      cls.subjects.forEach(function (sub) {
        sub.competencies = sub.competencies || [];
        sub.categories = sub.categories || [];
        sub.assignments = sub.assignments || [];
        sub.assignments.forEach(function (a, i) {
          if (!a.createdAt) a.createdAt = base + i;
          a.grades = a.grades || {};
        });
      });
    });
    if (!findClass(state.ui.selectedClassId) && state.classes.length) {
      state.ui.selectedClassId = state.classes[0].id;
    }
    if (!state.ui.expandedAssignments) state.ui.expandedAssignments = {};
    if (!state.ui.gradebookSort) state.ui.gradebookSort = 'category';
    if (!state.ui.theme) state.ui.theme = 'light';
  }

  // ---------------------------------------------------------------- model helpers
  function findClass(id) { return state.classes.filter(function (c) { return c.id === id; })[0] || null; }
  function currentClass() { return findClass(state.ui.selectedClassId); }
  function subjectById(cls, id) { return cls.subjects.filter(function (s) { return s.id === id; })[0] || null; }
  function currentSubject() {
    var cls = currentClass(); if (!cls) return null;
    return subjectById(cls, state.ui.classTab);
  }
  function competencyById(subject, id) { return subject.competencies.filter(function (c) { return c.id === id; })[0] || null; }
  function assignmentById(subject, id) { return subject.assignments.filter(function (a) { return a.id === id; })[0] || null; }
  function catNameFor(subject, a) {
    var c = subject.categories.filter(function (x) { return x.id === a.categoryId; })[0];
    return c ? c.name : '';
  }

  function assignmentsByCategory(subject) {
    var map = {};
    subject.categories.forEach(function (cat) { map[cat.id] = []; });
    subject.assignments.forEach(function (a) { (map[a.categoryId] = map[a.categoryId] || []).push(a); });
    return map;
  }
  function gradesForStudent(subject, studentId) {
    var out = {};
    subject.assignments.forEach(function (a) { if (a.grades && a.grades[studentId]) out[a.id] = a.grades[studentId]; });
    return out;
  }
  function studentOverall(subject, studentId) {
    return calc.overallGrade(subject.categories, assignmentsByCategory(subject), gradesForStudent(subject, studentId));
  }
  function classAverage(cls, subject) {
    var sum = 0, n = 0;
    cls.students.forEach(function (s) {
      var v = studentOverall(subject, s.id).value;
      if (v !== null) { sum += v; n++; }
    });
    return n ? sum / n : null;
  }

  // ---------------------------------------------------------------- theme
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.ui.theme === 'dark' ? 'dark' : 'light');
    var btn = $('#theme-btn');
    if (btn) btn.textContent = state.ui.theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode';
  }

  // ---------------------------------------------------------------- rendering
  function render() { renderSidebar(); renderMain(); }

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
      var subj = c.subjects.length === 1 ? c.subjects[0].name :
        c.subjects.length + ' subjects';
      div.innerHTML = '<span class="ci-name">' + esc(c.name) + '</span>' +
        '<span class="ci-sub">' + (c.grade ? 'Gr ' + esc(c.grade) + ' · ' : '') +
        esc(subj) + ' · ' + c.students.length + ' students</span>';
      div.addEventListener('click', function () {
        state.ui.selectedClassId = c.id;
        state.ui.classTab = null; // re-resolve default for the new class
        saveSoon(); render();
      });
      list.appendChild(div);
    });
  }

  function resolveClassTab(cls) {
    var t = state.ui.classTab;
    if (t === 'summary' || t === 'students') return t;
    if (t && subjectById(cls, t)) return t;
    return cls.subjects.length ? cls.subjects[0].id : 'students';
  }

  function renderMain() {
    var empty = $('#main-empty');
    var view = $('#class-view');
    var cls = currentClass();
    if (!cls) {
      empty.classList.remove('hidden');
      view.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    view.classList.remove('hidden');

    state.ui.classTab = resolveClassTab(cls);

    var subjCount = cls.subjects.length;
    $('#class-title').textContent = cls.name;
    $('#class-subtitle').textContent = (cls.grade ? 'Grade ' + cls.grade + ' · ' : '') +
      cls.students.length + ' students · ' + subjCount + ' subject' + (subjCount === 1 ? '' : 's');

    renderSubjectNav(cls);
    renderSubTabs(cls);
    renderClassContent(cls);
  }

  function renderSubjectNav(cls) {
    var nav = $('#subject-nav');
    var active = state.ui.classTab;
    var html = '<div class="sn-group">' +
      '<button class="sn-btn' + (active === 'summary' ? ' active' : '') + '" data-classtab="summary">Summary</button>' +
      '<button class="sn-btn' + (active === 'students' ? ' active' : '') + '" data-classtab="students">Students <span class="sn-count">' + cls.students.length + '</span></button>' +
      '</div><div class="sn-sep"></div><div class="sn-subjects">';
    cls.subjects.forEach(function (sub) {
      html += '<button class="sn-btn subject' + (active === sub.id ? ' active' : '') + '" data-classtab="' + sub.id + '">' +
        esc(sub.name) + '</button>';
    });
    html += '<button class="sn-btn add" id="add-subject-btn">+ Subject</button></div>';
    nav.innerHTML = html;

    $all('[data-classtab]', nav).forEach(function (b) {
      b.addEventListener('click', function () {
        state.ui.classTab = b.dataset.classtab; saveSoon(); renderMain();
      });
    });
    $('#add-subject-btn', nav).addEventListener('click', function () { openSubjectModal(cls, null); });
  }

  function renderSubTabs(cls) {
    var el = $('#sub-tabs');
    var subject = currentSubject();
    if (!subject) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.classList.remove('hidden');
    var tabs = [
      ['gradebook', 'Gradebook'], ['report', 'By Competency'],
      ['assignments', 'Assignments'], ['competencies', 'Competencies']
    ];
    el.innerHTML = tabs.map(function (t) {
      return '<button class="tab' + (state.ui.subjectTab === t[0] ? ' active' : '') + '" data-subtab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') +
      '<button class="btn btn-ghost btn-sm" id="edit-subject-btn" style="margin-left:auto;align-self:center">Rename / delete subject</button>';
    $all('[data-subtab]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        state.ui.subjectTab = b.dataset.subtab; saveSoon(); renderMain();
      });
    });
    $('#edit-subject-btn', el).addEventListener('click', function () {
      var cls = currentClass(); openSubjectManageModal(cls, subject);
    });
  }

  function renderClassContent(cls) {
    var host = $('#tab-content');
    host.innerHTML = '';
    var tab = state.ui.classTab;
    if (tab === 'summary') return renderSummary(host, cls);
    if (tab === 'students') return renderStudents(host, cls);
    var subject = subjectById(cls, tab);
    if (!subject) return;
    switch (state.ui.subjectTab) {
      case 'gradebook': return renderGradebook(host, cls, subject);
      case 'report': return renderCompetencyReport(host, cls, subject);
      case 'assignments': return renderAssignments(host, cls, subject);
      case 'competencies': return renderCompetencies(host, cls, subject);
    }
  }

  function scaleLegendHTML() {
    var chips = calc.PROFICIENCY_LEVELS.map(function (l) {
      return '<span class="scale-chip"><span class="scale-swatch" style="background:' +
        l.color + '"></span>' + l.value + ' · ' + esc(l.label) + '</span>';
    }).join('');
    return '<div class="scale-legend">' + chips + '</div>';
  }

  function gradePillHTML(score) {
    if (score === null || score === undefined) return '<span class="grade-pill empty">—</span>';
    var lvl = calc.levelForValue(score);
    return '<span class="grade-pill" style="background:' + calc.colorForValue(score) +
      '" title="' + esc(lvl.label) + ' (' + score.toFixed(2) + ')">' + lvl.short + '</span>';
  }
  function overallPillHTML(value) {
    if (value === null || value === undefined) return '<span class="grade-pill empty">—</span>';
    var lvl = calc.levelForValue(value);
    return '<span class="grade-pill overall-pill" style="background:' + calc.colorForValue(value) +
      '" title="' + esc(lvl.label) + ' (' + value.toFixed(2) + ')">' + lvl.short + ' · ' + value.toFixed(1) + '</span>';
  }
  function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // ---------------------------------------------------------------- Summary (class → subjects)
  function renderSummary(host, cls) {
    if (!cls.subjects.length) {
      host.innerHTML = '<div class="card"><h2>Summary</h2>' +
        '<p class="card-sub">Add the subjects you teach this class to see each student\'s ' +
        'grade in every course here.</p>' +
        '<button class="btn btn-primary" id="sum-add-subject">+ Add a subject</button></div>';
      $('#sum-add-subject', host).addEventListener('click', function () { openSubjectModal(cls, null); });
      return;
    }
    var heads = cls.subjects.map(function (sub) {
      return '<th style="text-align:center" class="dash-open" data-open-subject="' + sub.id + '">' + esc(sub.name) + '</th>';
    }).join('');
    var rows = cls.students.map(function (stu) {
      var cells = cls.subjects.map(function (sub) {
        return '<td style="text-align:center">' + overallPillHTML(studentOverall(sub, stu.id).value) + '</td>';
      }).join('');
      return '<tr><td class="student-col">' + esc(stu.name) + '</td>' + cells + '</tr>';
    }).join('');
    var avgCells = cls.subjects.map(function (sub) {
      return '<td style="text-align:center">' + overallPillHTML(classAverage(cls, sub)) + '</td>';
    }).join('');

    host.innerHTML = '<div class="section-head"><h2>Class summary</h2>' +
      '<span class="muted" style="font-size:12px">Each student\'s current grade in every subject · click a subject to open it</span></div>' +
      (cls.students.length ?
        '<div class="gradebook-wrap"><table class="gradebook"><thead><tr>' +
        '<th class="student-col">Student</th>' + heads + '</tr></thead><tbody>' + rows +
        '<tr class="avg-row"><td class="student-col"><b>Class average</b></td>' + avgCells + '</tr>' +
        '</tbody></table></div>' :
        '<div class="empty-hint">No students yet — add them in the <b>Students</b> tab.</div>') +
      '<div class="card" style="margin-top:16px"><div class="card-sub">Grade scale</div>' + scaleLegendHTML() + '</div>';

    $all('[data-open-subject]', host).forEach(function (el) {
      el.addEventListener('click', function () {
        state.ui.classTab = el.dataset.openSubject; state.ui.subjectTab = 'gradebook'; saveSoon(); renderMain();
      });
    });
  }

  // ---------------------------------------------------------------- Students (class roster)
  function renderStudents(host, cls) {
    var rows = cls.students.map(function (s, i) {
      return '<tr><td style="width:40px">' + (i + 1) + '</td><td>' + esc(s.name) + '</td>' +
        '<td style="width:130px"><div class="row-actions">' +
        '<button class="btn btn-sm btn-ghost" data-rename-stu="' + s.id + '">Rename</button>' +
        '<button class="btn btn-sm btn-ghost danger" data-del-stu="' + s.id + '">✕</button>' +
        '</div></td></tr>';
    }).join('');

    host.innerHTML = '<div class="card"><div class="section-head">' +
      '<div><h2>Students</h2><div class="card-sub">' + cls.students.length +
      ' students on this class roster — shared across every subject you teach them.</div></div>' +
      '<button class="btn btn-primary btn-sm" id="add-students-btn">+ Add students</button></div>' +
      (cls.students.length ?
        '<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Name</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' :
        '<div class="empty-hint">No students yet. Add them one per line.</div>') + '</div>';

    $('#add-students-btn', host).addEventListener('click', function () {
      openTextareaModal('Add students', 'Enter one student name per line:', '', function (text) {
        text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (name) {
          cls.students.push({ id: uid(), name: name });
        });
        saveSoon(); renderMain();
      });
    });
    $all('[data-rename-stu]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var s = cls.students.filter(function (x) { return x.id === b.dataset.renameStu; })[0];
        promptText('Rename student', 'Name', s.name, function (name) {
          if (name) { s.name = name; saveSoon(); renderMain(); }
        });
      });
    });
    $all('[data-del-stu]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var s = cls.students.filter(function (x) { return x.id === b.dataset.delStu; })[0];
        confirmModal('Remove student?', 'Remove "' + esc(s.name) + '" and their grades from every subject in this class?', function () {
          cls.students = cls.students.filter(function (x) { return x.id !== s.id; });
          cls.subjects.forEach(function (sub) {
            sub.assignments.forEach(function (a) { if (a.grades) delete a.grades[s.id]; });
          });
          saveSoon(); renderMain();
        });
      });
    });
  }

  // ---------------------------------------------------------------- Gradebook (subject)
  function openAssignmentInGradebook(subject, id) {
    state.ui.expandedAssignments[id] = true;
    state.ui.subjectTab = 'gradebook';
    pendingGradeFocus = true;
    saveSoon(); renderMain();
  }

  function sortedAssignments(subject) {
    var sort = state.ui.gradebookSort || 'category';
    if (sort === 'date') {
      return subject.assignments.slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    }
    var order = {};
    subject.categories.forEach(function (c, i) { order[c.id] = i; });
    return subject.assignments.slice().sort(function (a, b) {
      var oa = order[a.categoryId], ob = order[b.categoryId];
      if (oa === undefined) oa = 999; if (ob === undefined) ob = 999;
      if (oa !== ob) return oa - ob;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function renderGradebook(host, cls, subject) {
    if (!cls.students.length || !subject.assignments.length) {
      host.innerHTML = '<div class="card"><div class="section-head"><h2>Gradebook</h2>' +
        '<button class="btn btn-primary btn-sm" id="gb-add-asg"' + (subject.categories.length ? '' : ' disabled title="Add a category first"') + '>+ New assignment</button></div>' +
        '<p class="card-sub">' +
        (!cls.students.length ? 'Add students in the <b>Students</b> tab. ' : '') +
        (!subject.assignments.length ? 'Create an assignment to start grading. ' : '') + '</p>' +
        '<div class="card-sub">Grade scale:</div>' + scaleLegendHTML() + '</div>';
      var add0 = $('#gb-add-asg', host);
      if (add0 && subject.categories.length) add0.addEventListener('click', function () { openAssignmentModal(cls, subject, null); });
      return;
    }

    var order = sortedAssignments(subject);
    var expanded = state.ui.expandedAssignments || {};
    var editCols = [];
    order.forEach(function (a) {
      if (expanded[a.id]) a.competencies.forEach(function (ac) { editCols.push({ aid: a.id, cid: ac.competencyId }); });
    });
    var editIndex = {};
    editCols.forEach(function (e, i) { editIndex[e.aid + '|' + e.cid] = i; });
    var hasSub = editCols.length > 0;
    var rs = hasSub ? ' rowspan="2"' : '';

    var row1 = '<th class="student-col"' + rs + '>Student</th>';
    var row2 = '';
    order.forEach(function (a) {
      var meta = state.ui.gradebookSort === 'date'
        ? new Date(a.createdAt || 0).toLocaleDateString() : catNameFor(subject, a);
      if (expanded[a.id]) {
        var span = a.competencies.length + 2;
        row1 += '<th class="asg-group" colspan="' + span + '" data-toggle="' + a.id + '">' +
          '<span class="ah-title">' + esc(a.title) + '</span> <span class="caret">▾ collapse</span>' +
          '<div class="cat-tag">' + esc(meta) + '</div></th>';
        a.competencies.forEach(function (ac) {
          var c = competencyById(subject, ac.competencyId);
          row2 += '<th class="asg-sub" title="' + esc(c ? c.name : '') + '">' +
            esc(truncate(c ? c.name : '(removed)', 16)) + '<div class="ah-meta">w' + ac.weight + '</div></th>';
        });
        row2 += '<th class="asg-sub sub-overall">Overall</th><th class="asg-sub sub-excuse">Excuse</th>';
      } else {
        row1 += '<th class="assignment-head"' + rs + '>' +
          '<span class="ah-toggle" data-toggle="' + a.id + '"><span class="ah-title">' + esc(a.title) + '</span> ' +
          '<span class="caret">▸ edit</span></span>' +
          '<div class="ah-meta">' + a.competencies.length + ' comp' + (a.competencies.length === 1 ? '' : 's') + '</div>' +
          '<div class="cat-tag">' + esc(meta) + '</div></th>';
      }
    });
    row1 += '<th class="overall-col"' + rs + '>Course<br>Overall</th>';

    var body = '';
    cls.students.forEach(function (stu, ri) {
      var row = '<td class="student-col">' + esc(stu.name) + '</td>';
      order.forEach(function (a) {
        var g = (a.grades && a.grades[stu.id]) || { scores: {}, excused: false };
        if (expanded[a.id]) {
          a.competencies.forEach(function (ac) {
            var ci = editIndex[a.id + '|' + ac.competencyId];
            var v = g.scores ? g.scores[ac.competencyId] : null;
            row += '<td class="grade-input-cell"><input type="number" min="1" max="8" step="1" ' +
              'class="num-input grade-input" data-r="' + ri + '" data-c="' + ci + '" ' +
              'data-assignment="' + a.id + '" data-student="' + stu.id + '" data-comp="' + ac.competencyId + '" ' +
              'value="' + (v == null ? '' : v) + '"' + (g.excused ? ' disabled' : '') + ' placeholder="—"></td>';
          });
          row += '<td class="asg-overall-cell" data-aid="' + a.id + '" data-sid="' + stu.id + '">' +
            (g.excused ? '<span class="grade-excused">Exc</span>' : gradePillHTML(calc.assignmentScore(a, g.scores))) + '</td>';
          row += '<td class="excuse-cell"><input type="checkbox" class="ex-toggle" data-assignment="' + a.id +
            '" data-student="' + stu.id + '"' + (g.excused ? ' checked' : '') + '></td>';
        } else {
          var inner = g.excused ? '<span class="grade-excused">Exc</span>' : gradePillHTML(calc.assignmentScore(a, g.scores));
          row += '<td class="grade-cell collapsed-cell" data-expand="' + a.id + '" title="Click to edit">' + inner + '</td>';
        }
      });
      row += '<td class="grade-cell overall-col course-overall" data-sid="' + stu.id + '">' +
        overallPillHTML(studentOverall(subject, stu.id).value) + '</td>';
      body += '<tr>' + row + '</tr>';
    });

    var anyExpanded = order.some(function (a) { return expanded[a.id]; });
    var bar = '<div class="section-head" style="align-items:center;gap:12px">' +
      '<div class="muted" style="font-size:12px;flex:1">Click an assignment to expand &amp; edit inline. ' +
      '<b>Enter</b> → next box for the student, then next student · <b>arrow keys</b> move in all directions.</div>' +
      '<button class="btn btn-primary btn-sm" id="gb-add-asg">+ New assignment</button>' +
      '<button class="btn btn-sm btn-ghost" id="gb-expand-all">' + (anyExpanded ? 'Collapse all' : 'Expand all') + '</button>' +
      '<span><label style="font-size:13px;font-weight:600;margin-right:6px">Order by:</label>' +
      '<select id="gb-sort" style="width:auto;display:inline-block">' +
      '<option value="category"' + (state.ui.gradebookSort === 'category' ? ' selected' : '') + '>Category</option>' +
      '<option value="date"' + (state.ui.gradebookSort === 'date' ? ' selected' : '') + '>Date created</option>' +
      '</select></span></div>';

    host.innerHTML = bar +
      '<div class="gradebook-wrap"><table class="gradebook"><thead><tr>' + row1 + '</tr>' +
      (hasSub ? '<tr>' + row2 + '</tr>' : '') + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="card" style="margin-top:16px"><div class="card-sub">Grade scale</div>' + scaleLegendHTML() + '</div>';

    if (hasSub) {
      var firstRow = host.querySelector('table.gradebook thead tr');
      if (firstRow) { var hh = firstRow.offsetHeight; $all('.asg-sub', host).forEach(function (th) { th.style.top = hh + 'px'; }); }
    }

    $('#gb-add-asg', host).addEventListener('click', function () { openAssignmentModal(cls, subject, null); });
    $('#gb-sort', host).addEventListener('change', function () { state.ui.gradebookSort = this.value; saveSoon(); renderClassContent(cls); });
    $('#gb-expand-all', host).addEventListener('click', function () {
      order.forEach(function (a) {
        if (anyExpanded) delete state.ui.expandedAssignments[a.id]; else state.ui.expandedAssignments[a.id] = true;
      });
      if (!anyExpanded) pendingGradeFocus = true;
      saveSoon(); renderClassContent(cls);
    });
    $all('[data-toggle]', host).forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.dataset.toggle;
        if (state.ui.expandedAssignments[id]) delete state.ui.expandedAssignments[id];
        else { state.ui.expandedAssignments[id] = true; pendingGradeFocus = true; }
        saveSoon(); renderClassContent(cls);
      });
    });
    $all('[data-expand]', host).forEach(function (el) {
      el.addEventListener('click', function () {
        state.ui.expandedAssignments[el.dataset.expand] = true; pendingGradeFocus = true; saveSoon(); renderClassContent(cls);
      });
    });

    var nRows = cls.students.length, nCols = editCols.length;
    function inputAt(r, c) { return host.querySelector('.grade-input[data-r="' + r + '"][data-c="' + c + '"]'); }
    function focusEl(el) { if (el && !el.disabled) { el.focus(); el.select(); return true; } return false; }
    function disabledAt(r, c) { var el = inputAt(r, c); return !el || el.disabled; }
    function stepMove(r, c, dr, dc) { var t = calc.nextEditableInDir(nRows, nCols, disabledAt, r, c, dr, dc); if (t) focusEl(inputAt(t.r, t.c)); }
    function enterNext(r, c) { var t = calc.nextEditableRowMajor(nRows, nCols, disabledAt, r, c); if (t) focusEl(inputAt(t.r, t.c)); }
    function updateAsgOverall(a, sid) {
      var cell = host.querySelector('.asg-overall-cell[data-aid="' + a.id + '"][data-sid="' + sid + '"]');
      if (!cell) return;
      var g = a.grades && a.grades[sid];
      cell.innerHTML = (g && g.excused) ? '<span class="grade-excused">Exc</span>' : gradePillHTML(calc.assignmentScore(a, g ? g.scores : null));
    }
    function updateCourseOverall(sid) {
      var cell = host.querySelector('.course-overall[data-sid="' + sid + '"]');
      if (cell) cell.innerHTML = overallPillHTML(studentOverall(subject, sid).value);
    }
    function persist(inp) {
      var a = assignmentById(subject, inp.dataset.assignment);
      var sid = inp.dataset.student, cid = inp.dataset.comp;
      a.grades = a.grades || {};
      var g = a.grades[sid] || { scores: {}, excused: false };
      g.scores = g.scores || {};
      var n = calc.toNumber(inp.value);
      if (n === null) delete g.scores[cid]; else g.scores[cid] = n;
      if (!g.excused && Object.keys(g.scores).length === 0) delete a.grades[sid]; else a.grades[sid] = g;
      updateAsgOverall(a, sid); updateCourseOverall(sid); saveSoon();
    }
    $all('.grade-input', host).forEach(function (inp) {
      inp.addEventListener('focus', function () { inp.select(); });
      inp.addEventListener('input', function () { persist(inp); });
      inp.addEventListener('change', function () { var n = calc.toNumber(inp.value); inp.value = n == null ? '' : n; persist(inp); });
      inp.addEventListener('keydown', function (e) {
        var r = Number(inp.dataset.r), c = Number(inp.dataset.c);
        switch (e.key) {
          case 'Enter': e.preventDefault(); enterNext(r, c); break;
          case 'ArrowDown': e.preventDefault(); stepMove(r, c, 1, 0); break;
          case 'ArrowUp': e.preventDefault(); stepMove(r, c, -1, 0); break;
          case 'ArrowRight': e.preventDefault(); stepMove(r, c, 0, 1); break;
          case 'ArrowLeft': e.preventDefault(); stepMove(r, c, 0, -1); break;
        }
      });
    });
    $all('.ex-toggle', host).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var a = assignmentById(subject, cb.dataset.assignment), sid = cb.dataset.student;
        a.grades = a.grades || {};
        var g = a.grades[sid] || { scores: {}, excused: false };
        g.excused = cb.checked;
        if (!g.excused && (!g.scores || Object.keys(g.scores).length === 0)) delete a.grades[sid]; else a.grades[sid] = g;
        $all('.grade-input[data-assignment="' + a.id + '"][data-student="' + sid + '"]', host).forEach(function (inp) { inp.disabled = cb.checked; });
        updateAsgOverall(a, sid); updateCourseOverall(sid); saveSoon();
      });
    });
    if (pendingGradeFocus && nCols > 0) focusEl(inputAt(0, 0));
    pendingGradeFocus = false;
  }

  // ---------------------------------------------------------------- By Competency report
  function competenciesByArea(subject) {
    var groups = [], index = {};
    subject.competencies.forEach(function (c) {
      var area = c.area || 'General';
      if (!index[area]) { index[area] = { area: area, comps: [] }; groups.push(index[area]); }
      index[area].comps.push(c);
    });
    return groups;
  }

  function renderCompetencyReport(host, cls, subject) {
    if (!subject.competencies.length || !cls.students.length) {
      host.innerHTML = '<div class="card"><h2>By Competency</h2><p class="card-sub">' +
        (!cls.students.length ? 'Add students first. ' : '') +
        (!subject.competencies.length ? 'Add curricular competencies first. ' : '') +
        'This report shows where each student stands on every competency.</p></div>';
      return;
    }
    var groups = competenciesByArea(subject);
    var flat = [];
    groups.forEach(function (g) { g.comps.forEach(function (c) { flat.push(c); }); });

    var row1 = '<th class="student-col" rowspan="2">Student</th>';
    var row2 = '';
    groups.forEach(function (g) {
      row1 += '<th class="cat-header" colspan="' + g.comps.length + '">' + esc(g.area) + '</th>';
      g.comps.forEach(function (c) {
        row2 += '<th class="asg-sub" title="' + esc(c.name) + '">' + esc(truncate(c.name, 18)) + '</th>';
      });
    });

    var body = cls.students.map(function (stu) {
      var cells = flat.map(function (c) {
        var v = calc.competencyStanding(subject.assignments, c.id, stu.id);
        return '<td style="text-align:center">' + gradePillHTML(v) + '</td>';
      }).join('');
      return '<tr><td class="student-col">' + esc(stu.name) + '</td>' + cells + '</tr>';
    }).join('');

    // class average per competency (mean of student standings)
    var avgCells = flat.map(function (c) {
      var sum = 0, n = 0;
      cls.students.forEach(function (stu) {
        var v = calc.competencyStanding(subject.assignments, c.id, stu.id);
        if (v !== null) { sum += v; n++; }
      });
      return '<td style="text-align:center">' + gradePillHTML(n ? sum / n : null) + '</td>';
    }).join('');

    host.innerHTML = '<div class="section-head"><h2>Standing by curricular competency</h2>' +
      '<span class="muted" style="font-size:12px">Each cell averages a student\'s grades across every assignment that assesses that competency — low cells show where to focus.</span></div>' +
      '<div class="gradebook-wrap"><table class="gradebook"><thead><tr>' + row1 + '</tr><tr>' + row2 + '</tr></thead>' +
      '<tbody>' + body + '<tr class="avg-row"><td class="student-col"><b>Class average</b></td>' + avgCells + '</tr></tbody></table></div>' +
      '<div class="card" style="margin-top:16px"><div class="card-sub">Grade scale</div>' + scaleLegendHTML() + '</div>';

    var firstRow = host.querySelector('table.gradebook thead tr');
    if (firstRow) { var hh = firstRow.offsetHeight; $all('.asg-sub', host).forEach(function (th) { th.style.top = hh + 'px'; }); }
  }

  // ---------------------------------------------------------------- Assignments (subject)
  function renderAssignments(host, cls, subject) {
    var byCat = assignmentsByCategory(subject);
    var totalWeight = subject.categories.reduce(function (s, c) { return s + (Number(c.weight) || 0); }, 0);

    var catRows = subject.categories.map(function (cat) {
      return '<tr><td>' + esc(cat.name) + '</td>' +
        '<td style="width:120px"><input type="number" min="0" class="cat-weight" data-cat="' + cat.id +
        '" value="' + (Number(cat.weight) || 0) + '" style="width:90px"> %</td>' +
        '<td style="width:150px"><div class="row-actions">' +
        '<button class="btn btn-sm btn-ghost" data-rename-cat="' + cat.id + '">Rename</button>' +
        '<button class="btn btn-sm btn-ghost danger" data-del-cat="' + cat.id + '">✕</button></div></td></tr>';
    }).join('');

    var catCard = '<div class="card"><div class="section-head"><div>' +
      '<h2>Categories &amp; weights</h2><div class="card-sub">Each category counts toward the overall grade by its weight (relative — need not total 100).</div></div>' +
      '<span class="pill-total">Total: ' + totalWeight + '%</span></div>' +
      (subject.categories.length ?
        '<div class="table-wrap"><table class="data"><thead><tr><th>Category</th><th>Weight</th><th></th></tr></thead><tbody>' + catRows + '</tbody></table></div>' :
        '<div class="empty-hint">No categories yet.</div>') +
      '<div style="margin-top:12px"><button class="btn btn-sm" id="add-cat-btn">+ Add category</button></div></div>';

    var asgSections = subject.categories.map(function (cat) {
      var list = (byCat[cat.id] || []).slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      if (!list.length) return '';
      var rows = list.map(function (a) {
        var comps = a.competencies.map(function (ac) {
          var c = competencyById(subject, ac.competencyId);
          return '<span class="tag">' + esc(c ? c.name : '(removed)') + ' · w' + ac.weight + '</span>';
        }).join(' ');
        return '<tr><td><b>' + esc(a.title) + '</b><div style="margin-top:4px">' + comps + '</div></td>' +
          '<td style="width:170px"><div class="row-actions">' +
          '<button class="btn btn-sm btn-ghost" data-edit-asg="' + a.id + '">Edit</button>' +
          '<button class="btn btn-sm" data-grade-asg="' + a.id + '">Grade</button>' +
          '<button class="btn btn-sm btn-ghost danger" data-del-asg="' + a.id + '">✕</button></div></td></tr>';
      }).join('');
      return '<h3 style="margin:16px 0 6px;font-size:14px">' + esc(cat.name) + '</h3>' +
        '<div class="table-wrap"><table class="data"><tbody>' + rows + '</tbody></table></div>';
    }).join('');

    var asgCard = '<div class="card"><div class="section-head">' +
      '<div><h2>Assignments</h2><div class="card-sub">Title + curricular competencies with weights. The overall assignment grade is generated automatically.</div></div>' +
      '<button class="btn btn-primary btn-sm" id="add-asg-btn"' + (subject.categories.length ? '' : ' disabled title="Add a category first"') + '>+ New assignment</button></div>' +
      (subject.assignments.length ? asgSections : '<div class="empty-hint">No assignments yet.</div>') + '</div>';

    host.innerHTML = catCard + asgCard;

    $('#add-cat-btn', host).addEventListener('click', function () {
      promptText('New category', 'Category name', '', function (name) {
        if (!name) return; subject.categories.push({ id: uid(), name: name, weight: 0 }); saveSoon(); renderClassContent(cls);
      });
    });
    $all('.cat-weight', host).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var cat = subject.categories.filter(function (c) { return c.id === inp.dataset.cat; })[0];
        if (cat) { cat.weight = Math.max(0, Number(inp.value) || 0); saveSoon(); renderClassContent(cls); }
      });
    });
    $all('[data-rename-cat]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var cat = subject.categories.filter(function (c) { return c.id === b.dataset.renameCat; })[0];
        promptText('Rename category', 'Category name', cat.name, function (name) { if (name) { cat.name = name; saveSoon(); renderClassContent(cls); } });
      });
    });
    $all('[data-del-cat]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var cat = subject.categories.filter(function (c) { return c.id === b.dataset.delCat; })[0];
        var count = subject.assignments.filter(function (a) { return a.categoryId === cat.id; }).length;
        confirmModal('Delete category?', 'Delete "' + esc(cat.name) + '"' + (count ? ' and its ' + count + ' assignment(s)' : '') + '?', function () {
          subject.assignments = subject.assignments.filter(function (a) { return a.categoryId !== cat.id; });
          subject.categories = subject.categories.filter(function (c) { return c.id !== cat.id; });
          saveSoon(); renderClassContent(cls);
        });
      });
    });
    var addAsg = $('#add-asg-btn', host);
    if (addAsg && subject.categories.length) addAsg.addEventListener('click', function () { openAssignmentModal(cls, subject, null); });
    $all('[data-edit-asg]', host).forEach(function (b) { b.addEventListener('click', function () { openAssignmentModal(cls, subject, b.dataset.editAsg); }); });
    $all('[data-grade-asg]', host).forEach(function (b) { b.addEventListener('click', function () { openAssignmentInGradebook(subject, b.dataset.gradeAsg); }); });
    $all('[data-del-asg]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var a = subject.assignments.filter(function (x) { return x.id === b.dataset.delAsg; })[0];
        confirmModal('Delete assignment?', 'Delete "' + esc(a.title) + '" and all its grades?', function () {
          subject.assignments = subject.assignments.filter(function (x) { return x.id !== a.id; }); saveSoon(); renderClassContent(cls);
        });
      });
    });
  }

  // ---------------------------------------------------------------- Competencies (subject)
  function renderCompetencies(host, cls, subject) {
    var groups = competenciesByArea(subject);
    var sections = groups.map(function (g) {
      var rows = g.comps.map(function (c) {
        return '<tr><td>' + esc(c.name) + '</td><td style="width:130px"><div class="row-actions">' +
          '<button class="btn btn-sm btn-ghost" data-edit-comp="' + c.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-ghost danger" data-del-comp="' + c.id + '">✕</button></div></td></tr>';
      }).join('');
      return '<h3 style="margin:14px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted)">' +
        esc(g.area) + '</h3><div class="table-wrap"><table class="data"><tbody>' + rows + '</tbody></table></div>';
    }).join('');

    host.innerHTML = '<div class="card"><div class="section-head">' +
      '<div><h2>Curricular competencies</h2><div class="card-sub">These appear (grouped by area) when you build an assignment. Pre-filled from the BC curriculum — edit freely.</div></div>' +
      '<button class="btn btn-primary btn-sm" id="add-comp-btn">+ Add competency</button></div>' +
      (subject.competencies.length ? sections : '<div class="empty-hint">No competencies yet.</div>') + '</div>';

    $('#add-comp-btn', host).addEventListener('click', function () { openCompetencyModal(cls, subject, null); });
    $all('[data-edit-comp]', host).forEach(function (b) { b.addEventListener('click', function () { openCompetencyModal(cls, subject, b.dataset.editComp); }); });
    $all('[data-del-comp]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = subject.competencies.filter(function (x) { return x.id === b.dataset.delComp; })[0];
        var used = subject.assignments.some(function (a) { return a.competencies.some(function (ac) { return ac.competencyId === c.id; }); });
        confirmModal('Delete competency?', 'Delete "' + esc(c.name) + '"?' + (used ? ' It is used by assignments; those references will be removed.' : ''), function () {
          subject.competencies = subject.competencies.filter(function (x) { return x.id !== c.id; });
          subject.assignments.forEach(function (a) {
            a.competencies = a.competencies.filter(function (ac) { return ac.competencyId !== c.id; });
            if (a.grades) Object.keys(a.grades).forEach(function (sid) { if (a.grades[sid].scores) delete a.grades[sid].scores[c.id]; });
          });
          saveSoon(); renderClassContent(cls);
        });
      });
    });
  }

  // ---------------------------------------------------------------- Modal infra
  function openModal(html, opts) {
    opts = opts || {};
    var root = $('#modal-root');
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '">' + html + '</div>';
    root.appendChild(backdrop);
    backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop && !opts.noBackdropClose) close(); });
    function close() { if (backdrop.parentNode) root.removeChild(backdrop); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    return { el: backdrop, close: close };
  }
  function promptText(title, label, value, cb) {
    var m = openModal('<h2>' + esc(title) + '</h2><div class="form-row"><label>' + esc(label) + '</label>' +
      '<input type="text" id="pt-input" value="' + esc(value) + '"></div>' +
      '<div class="modal-actions"><button class="btn" id="pt-cancel">Cancel</button><button class="btn btn-primary" id="pt-ok">Save</button></div>');
    var inp = $('#pt-input', m.el); inp.focus(); inp.select();
    $('#pt-cancel', m.el).addEventListener('click', m.close);
    function done() { var v = inp.value.trim(); m.close(); cb(v); }
    $('#pt-ok', m.el).addEventListener('click', done);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(); });
  }
  function openTextareaModal(title, label, value, cb) {
    var m = openModal('<h2>' + esc(title) + '</h2><div class="form-row"><label>' + esc(label) + '</label>' +
      '<textarea id="ta-input" rows="8">' + esc(value) + '</textarea></div>' +
      '<div class="modal-actions"><button class="btn" id="ta-cancel">Cancel</button><button class="btn btn-primary" id="ta-ok">Add</button></div>');
    var inp = $('#ta-input', m.el); inp.focus();
    $('#ta-cancel', m.el).addEventListener('click', m.close);
    $('#ta-ok', m.el).addEventListener('click', function () { var v = inp.value; m.close(); cb(v); });
  }
  function confirmModal(title, msg, cb, opts) {
    opts = opts || {};
    var m = openModal('<h2>' + esc(title) + '</h2><p class="modal-sub">' + msg + '</p>' +
      '<div class="modal-actions"><button class="btn" id="cf-cancel">Cancel</button>' +
      '<button class="btn ' + (opts.okClass || 'danger') + '" id="cf-ok">' + esc(opts.okLabel || 'Delete') + '</button></div>');
    $('#cf-cancel', m.el).addEventListener('click', m.close);
    $('#cf-ok', m.el).addEventListener('click', function () { m.close(); cb(); });
  }

  // ---------------------------------------------------------------- Modal: class
  function openClassModal(existing) {
    var isEdit = !!existing;
    var gradeOptions = CURR.GRADES.map(function (g) { return '<option value="' + g + '">Grade ' + g + '</option>'; }).join('');
    var templateOptions = CURR.SUBJECT_TEMPLATES.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join('');

    var html = '<h2>' + (isEdit ? 'Edit class' : 'Add a class') + '</h2>' +
      '<p class="modal-sub">A class is a group of students. Name it for the group — e.g. "Homeroom 8A" ' +
      '(you\'ll add several subjects) or "Math 8 — Block D" (one subject).</p>' +
      '<div class="inline-fields"><div class="form-row" style="flex:2"><label>Class name</label>' +
      '<input type="text" id="cm-name" placeholder="e.g. Homeroom 8A" value="' + esc(isEdit ? existing.name : '') + '"></div>' +
      '<div class="form-row"><label>Grade</label><select id="cm-grade"><option value="">—</option>' + gradeOptions + '</select></div></div>';
    if (!isEdit) {
      html += '<div class="form-row"><label>Add a first subject <span class="hint">optional — you can add more later</span></label>' +
        '<select id="cm-firstsubject"><option value="">None for now</option>' + templateOptions + '<option value="__blank__">Blank subject</option></select></div>';
    }
    html += '<div class="modal-actions"><button class="btn" id="cm-cancel">Cancel</button>' +
      '<button class="btn btn-primary" id="cm-save">' + (isEdit ? 'Save' : 'Create class') + '</button></div>';

    var m = openModal(html);
    var nameInp = $('#cm-name', m.el); nameInp.focus();
    var gradeSel = $('#cm-grade', m.el);
    if (isEdit && existing.grade) gradeSel.value = existing.grade;
    $('#cm-cancel', m.el).addEventListener('click', m.close);
    $('#cm-save', m.el).addEventListener('click', function () {
      var name = nameInp.value.trim();
      if (!name) { nameInp.focus(); return; }
      var grade = gradeSel.value;
      if (isEdit) {
        existing.name = name; existing.grade = grade;
      } else {
        var cls = { id: uid(), name: name, grade: grade, students: [], subjects: [] };
        var firstSel = $('#cm-firstsubject', m.el).value;
        if (firstSel) {
          var tpl = firstSel === '__blank__' ? null : CURR.templateById(firstSel);
          cls.subjects.push(makeSubject(tpl, grade));
        }
        state.classes.push(cls);
        state.ui.selectedClassId = cls.id;
        state.ui.classTab = cls.subjects.length ? cls.subjects[0].id : 'students';
      }
      m.close(); saveSoon(); render();
    });
  }

  // Build a Subject from an optional template at a grade.
  function makeSubject(tpl, grade) {
    return {
      id: uid(),
      name: tpl ? tpl.name : 'New subject',
      competencies: tpl ? CURR.competenciesFor(tpl, grade).map(function (c) { return { id: uid(), name: c.name, area: c.area }; }) : [],
      categories: (tpl ? CURR.DEFAULT_CATEGORIES : []).map(function (c) { return { id: uid(), name: c.name, weight: c.weight }; }),
      assignments: []
    };
  }

  // ---------------------------------------------------------------- Modal: subject
  function openSubjectModal(cls, existing) {
    var isEdit = !!existing;
    var templateOptions = CURR.SUBJECT_TEMPLATES.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join('');
    var html = '<h2>' + (isEdit ? 'Rename subject' : 'Add a subject') + '</h2>';
    if (isEdit) {
      html += '<div class="form-row"><label>Subject name</label><input type="text" id="sm-name" value="' + esc(existing.name) + '"></div>';
    } else {
      html += '<p class="modal-sub">Pick a BC subject to pre-fill its curricular competencies for ' +
        (cls.grade ? 'Grade ' + esc(cls.grade) : 'this class') + ', or start blank.</p>' +
        '<div class="form-row"><label>Start from a BC subject</label>' +
        '<select id="sm-template"><option value="">Blank (fully custom)</option>' + templateOptions + '</select></div>' +
        '<div class="form-row"><label>Subject name <span class="hint">optional override</span></label>' +
        '<input type="text" id="sm-name" placeholder="auto-filled from subject"></div>' +
        '<div id="sm-preview" class="live-overall" style="display:none"></div>';
    }
    html += '<div class="modal-actions"><button class="btn" id="sm-cancel">Cancel</button>' +
      '<button class="btn btn-primary" id="sm-save">' + (isEdit ? 'Save' : 'Add subject') + '</button></div>';

    var m = openModal(html);
    var nameInp = $('#sm-name', m.el); nameInp.focus();
    var tplSel = $('#sm-template', m.el);
    var preview = $('#sm-preview', m.el);
    if (tplSel) tplSel.addEventListener('change', function () {
      var t = CURR.templateById(tplSel.value);
      nameInp.placeholder = t ? t.name : 'auto-filled from subject';
      if (!t) { preview.style.display = 'none'; return; }
      var comps = CURR.competenciesFor(t, cls.grade);
      preview.style.display = 'block';
      preview.innerHTML = 'Adds <b>' + comps.length + '</b> competencies and <b>' + CURR.DEFAULT_CATEGORIES.length + '</b> categories' +
        (cls.grade ? ' for Grade ' + esc(cls.grade) : '') + '.';
    });
    $('#sm-cancel', m.el).addEventListener('click', m.close);
    $('#sm-save', m.el).addEventListener('click', function () {
      if (isEdit) {
        var nm = nameInp.value.trim(); if (!nm) return;
        existing.name = nm; m.close(); saveSoon(); renderMain();
      } else {
        var tpl = CURR.templateById(tplSel.value);
        var sub = makeSubject(tpl, cls.grade);
        var override = nameInp.value.trim();
        if (override) sub.name = override; else if (!tpl) sub.name = 'New subject';
        cls.subjects.push(sub);
        state.ui.classTab = sub.id; state.ui.subjectTab = 'gradebook';
        m.close(); saveSoon(); renderMain();
      }
    });
  }

  // ---------------------------------------------------------------- Modal: competency
  function openCompetencyModal(cls, subject, id) {
    var existing = id ? competencyById(subject, id) : null;
    var m = openModal('<h2>' + (existing ? 'Edit' : 'Add') + ' competency</h2>' +
      '<div class="form-row"><label>Competency</label><textarea id="co-name" rows="2">' + esc(existing ? existing.name : '') + '</textarea></div>' +
      '<div class="form-row"><label>Area / grouping <span class="hint">optional</span></label>' +
      '<input type="text" id="co-area" value="' + esc(existing ? existing.area : '') + '" placeholder="e.g. Comprehend &amp; Connect"></div>' +
      '<div class="modal-actions"><button class="btn" id="co-cancel">Cancel</button><button class="btn btn-primary" id="co-save">Save</button></div>');
    $('#co-name', m.el).focus();
    $('#co-cancel', m.el).addEventListener('click', m.close);
    $('#co-save', m.el).addEventListener('click', function () {
      var name = $('#co-name', m.el).value.trim(); var area = $('#co-area', m.el).value.trim();
      if (!name) return;
      if (existing) { existing.name = name; existing.area = area; } else subject.competencies.push({ id: uid(), name: name, area: area });
      m.close(); saveSoon(); renderClassContent(cls);
    });
  }

  // ---------------------------------------------------------------- Modal: assignment (accordion picker)
  function openAssignmentModal(cls, subject, id) {
    var existing = id ? assignmentById(subject, id) : null;
    var selected = {};
    if (existing) existing.competencies.forEach(function (ac) { selected[ac.competencyId] = ac.weight; });

    var catOptions = subject.categories.map(function (c) {
      return '<option value="' + c.id + '"' + (existing && existing.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');

    var groups = competenciesByArea(subject);
    var pickerHTML = groups.map(function (g, gi) {
      var selCount = g.comps.filter(function (c) { return selected.hasOwnProperty(c.id); }).length;
      var open = selCount > 0;
      var rows = g.comps.map(function (c) {
        var isSel = selected.hasOwnProperty(c.id);
        var w = isSel ? selected[c.id] : 1;
        return '<div class="comp-pick-row"><input type="checkbox" data-comp="' + c.id + '"' + (isSel ? ' checked' : '') + '>' +
          '<div class="cp-main">' + esc(c.name) + '</div>' +
          '<label class="weight-badge">weight <input type="number" min="0" step="1" class="cp-weight num-input" ' +
          'data-comp-weight="' + c.id + '" value="' + w + '" style="width:60px"' + (isSel ? '' : ' disabled') + '></label></div>';
      }).join('');
      return '<div class="comp-group" data-gi="' + gi + '">' +
        '<div class="comp-group-head" data-toggle-group="' + gi + '">' +
        '<span class="caret">' + (open ? '▾' : '▸') + '</span> <span class="cg-name">' + esc(g.area) + '</span>' +
        '<span class="cg-count" data-count="' + gi + '">' + (selCount ? selCount + ' selected' : g.comps.length + ' options') + '</span></div>' +
        '<div class="comp-group-body"' + (open ? '' : ' hidden') + '>' + rows + '</div></div>';
    }).join('');

    var html = '<h2>' + (existing ? 'Edit assignment' : 'New assignment') + '</h2>' +
      '<p class="modal-sub">Give it a title, then open a grouping and check the competencies it assesses. Set a weight for each; the overall grade is generated automatically.</p>' +
      '<div class="inline-fields"><div class="form-row" style="flex:2"><label>Title</label>' +
      '<input type="text" id="as-title" placeholder="e.g. Fractions Quiz" value="' + esc(existing ? existing.title : '') + '"></div>' +
      '<div class="form-row" style="flex:1"><label>Category</label><select id="as-cat">' + catOptions + '</select></div></div>' +
      '<div class="form-row"><label>Curricular competencies <span class="hint">open a grouping to choose</span></label>' +
      (subject.competencies.length ? '<div class="comp-picker">' + pickerHTML + '</div>' :
        '<div class="warn">This subject has no competencies yet — add some in the Competencies tab first.</div>') +
      '<div id="as-warn" class="warn"></div></div>' +
      '<div class="modal-actions"><button class="btn" id="as-cancel">Cancel</button>' +
      '<button class="btn btn-primary" id="as-save">' + (existing ? 'Save' : 'Create') + '</button></div>';

    var m = openModal(html, { wide: true });
    $('#as-title', m.el).focus();

    $all('[data-toggle-group]', m.el).forEach(function (head) {
      head.addEventListener('click', function () {
        var body = head.nextElementSibling;
        var hidden = body.hasAttribute('hidden');
        if (hidden) body.removeAttribute('hidden'); else body.setAttribute('hidden', '');
        $('.caret', head).textContent = hidden ? '▾' : '▸';
      });
    });
    function updateCount(gi) {
      var body = $('.comp-group[data-gi="' + gi + '"] .comp-group-body', m.el);
      var total = $all('[data-comp]', body).length;
      var sel = $all('[data-comp]', body).filter(function (cb) { return cb.checked; }).length;
      $('.cg-count[data-count="' + gi + '"]', m.el).textContent = sel ? sel + ' selected' : total + ' options';
    }
    $all('[data-comp]', m.el).forEach(function (cb) {
      cb.addEventListener('change', function () {
        var w = $('[data-comp-weight="' + cb.dataset.comp + '"]', m.el);
        w.disabled = !cb.checked;
        var gi = cb.closest('.comp-group').dataset.gi;
        updateCount(gi);
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
      if (!comps.some(function (c) { return c.weight > 0; })) { warn.textContent = 'At least one competency needs a weight above 0.'; return; }
      var catId = $('#as-cat', m.el).value;
      if (existing) {
        existing.title = title; existing.categoryId = catId; existing.competencies = comps;
        var keep = {}; comps.forEach(function (c) { keep[c.competencyId] = true; });
        if (existing.grades) Object.keys(existing.grades).forEach(function (sid) {
          var sc = existing.grades[sid].scores || {};
          Object.keys(sc).forEach(function (cid) { if (!keep[cid]) delete sc[cid]; });
        });
      } else {
        subject.assignments.push({ id: uid(), title: title, categoryId: catId, competencies: comps, grades: {}, createdAt: Date.now() });
      }
      m.close(); saveSoon(); renderClassContent(cls);
    });
  }

  // ---------------------------------------------------------------- Excel export
  function gradeCellText(value) {
    if (value === null || value === undefined) return '';
    return calc.labelForValue(value) + ' (' + value.toFixed(1) + ')';
  }
  // One sheet per class: rows = students, columns = subjects, cells = overall
  // grade (proficiency label + numeric), plus a class-average row.
  function buildGradeSheets() {
    return state.classes.map(function (cls) {
      var header = ['Student'].concat(cls.subjects.map(function (s) { return s.name; }));
      var rows = [header];
      cls.students.forEach(function (stu) {
        var row = [stu.name];
        cls.subjects.forEach(function (sub) { row.push(gradeCellText(studentOverall(sub, stu.id).value)); });
        rows.push(row);
      });
      if (cls.subjects.length) {
        var avg = ['Class average'];
        cls.subjects.forEach(function (sub) { avg.push(gradeCellText(classAverage(cls, sub))); });
        rows.push(avg);
      }
      var label = (cls.grade ? 'Gr' + cls.grade + ' ' : '') + cls.name;
      return { name: label, rows: rows };
    });
  }

  // ---------------------------------------------------------------- chrome
  function wireChrome() {
    $('#add-class-btn').addEventListener('click', function () { openClassModal(null); });
    $('#empty-add-class').addEventListener('click', function () { openClassModal(null); });
    $('#edit-class-btn').addEventListener('click', function () { var c = currentClass(); if (c) openClassModal(c); });
    $('#delete-class-btn').addEventListener('click', function () {
      var c = currentClass(); if (!c) return;
      confirmModal('Delete class?', 'Delete "' + esc(c.name) + '" and all its subjects, students and grades? This cannot be undone.', function () {
        state.classes = state.classes.filter(function (x) { return x.id !== c.id; });
        state.ui.selectedClassId = state.classes.length ? state.classes[0].id : null;
        state.ui.classTab = null;
        saveSoon(); render();
      });
    });
    // subject edit/delete via right-click? Provide buttons in subject-nav context — add small controls:
    $('#theme-btn').addEventListener('click', function () {
      state.ui.theme = state.ui.theme === 'dark' ? 'light' : 'dark';
      applyTheme(); saveSoon();
    });
    $('#export-btn').addEventListener('click', function () {
      window.api.exportData({ version: state.version, classes: state.classes, ui: state.ui }).then(function (r) { if (r && r.ok) setStatus('Exported backup'); });
    });
    $('#export-xlsx-btn').addEventListener('click', function () {
      if (!state.classes.length) { setStatus('No classes to export'); return; }
      window.api.exportXlsx({ defaultName: 'grades.xlsx', sheets: buildGradeSheets() }).then(function (r) {
        if (r && r.ok) setStatus('Exported grades to Excel');
        else if (r && r.error) setStatus('Excel export error');
      });
    });
    $('#import-btn').addEventListener('click', function () {
      confirmModal('Import backup?', 'Importing replaces all current data with the backup file. Continue?', function () {
        window.api.importData().then(function (r) {
          if (r && r.ok && r.data && r.data.classes) {
            state.classes = r.data.classes;
            state.ui.selectedClassId = state.classes.length ? state.classes[0].id : null;
            state.ui.classTab = null;
            migrate(); saveSoon(); render(); setStatus('Imported backup');
          }
        });
      }, { okLabel: 'Choose file…', okClass: 'btn-primary' });
    });
  }

  wireChrome();
  load();

  // Expose a couple of actions used by the subject-nav (edit/remove subject) via
  // double-click on a subject tab.
  document.addEventListener('dblclick', function (e) {
    var btn = e.target.closest && e.target.closest('.sn-btn.subject');
    if (!btn) return;
    var cls = currentClass(); if (!cls) return;
    var sub = subjectById(cls, btn.dataset.classtab); if (!sub) return;
    openSubjectManageModal(cls, sub);
  });

  function openSubjectManageModal(cls, sub) {
    var m = openModal('<h2>' + esc(sub.name) + '</h2><p class="modal-sub">Manage this subject.</p>' +
      '<div class="modal-actions" style="justify-content:space-between">' +
      '<button class="btn danger" id="subj-del">Delete subject</button>' +
      '<span><button class="btn" id="subj-cancel">Close</button> ' +
      '<button class="btn btn-primary" id="subj-rename">Rename</button></span></div>');
    $('#subj-cancel', m.el).addEventListener('click', m.close);
    $('#subj-rename', m.el).addEventListener('click', function () { m.close(); openSubjectModal(cls, sub); });
    $('#subj-del', m.el).addEventListener('click', function () {
      m.close();
      confirmModal('Delete subject?', 'Delete "' + esc(sub.name) + '" and all its assignments and grades from this class?', function () {
        cls.subjects = cls.subjects.filter(function (s) { return s.id !== sub.id; });
        state.ui.classTab = null;
        saveSoon(); renderMain();
      });
    });
  }
})();
