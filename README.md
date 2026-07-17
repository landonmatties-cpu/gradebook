# BC Gradebook

A simple, fully customizable **standalone desktop gradebook** for BC
middle-school teachers. It runs on **Windows and macOS**, works completely
offline, and stores all your data in a local file on your own computer.

Assessment uses a modified **BC proficiency scale**:

| # | Level        | | # | Level        |
|---|--------------|-|---|--------------|
| 1 | Emerging     | | 5 | Proficient − |
| 2 | Developing − | | 6 | Proficient   |
| 3 | Developing   | | 7 | Proficient + |
| 4 | Developing + | | 8 | Extending    |

When entering grades you just **type the number 1–8** — no dropdowns.

---

## What it does

- **Fully customizable, no fixed course load.** Add as many classes as you
  like. Start a class *blank* or from a **core BC subject** (English Language
  Arts, Mathematics, Science, Social Studies, PHE, ADST, Arts, Career
  Education, Core French) — which pre-fills that subject's **curricular
  competencies** and a set of default categories. Everything stays editable.
- **Grade-specific curriculum.** Choose the **grade (6, 7, or 8)** for a class.
  For Math, Science, and Social Studies the class is additionally pre-filled
  with that **grade's Content learning standards**, so a Grade 6 class differs
  from a Grade 7 one. (BC's *curricular competencies* are consistent across
  6–8, so those are shared; the grade-specific *content* is what changes.)
- **Multiple sections of the same subject.** e.g. "Math 8 — Block A" and
  "Math 8 — Block D" are separate classes with their own students and grades.
- **Easy assignments.** An assignment is just a **title** + the **curricular
  competencies** it assesses (chosen from a checklist). Give each competency a
  **weight**, and the overall assignment grade is **generated automatically**
  as the weighted average.
- **Spreadsheet-style grade entry.** Pick an assignment and grade the whole
  class in one editable grid — **type `1`–`8`** in each cell and move with the
  **keyboard** (Enter/↓ down, Tab across). No pop-up windows; it saves as you
  type and the overall updates live.
- **Sortable gradebook.** Order the overview columns **by category** or **by
  date created**.
- **Categories with weights.** Create categories (Quizzes, Projects, Homework,
  Tests…) and set each one's weight toward the overall grade.
- **Excuse individual students** from any assignment — excused work is left
  out of that student's averages.
- **Automatic overall grade** per student: weighted across categories, with
  empty/excused work correctly dropped and weights renormalized.
- **Backups.** Export/import your whole gradebook as a JSON file.

> The pre-filled BC content topics are a convenient starting point — please
> confirm wording against the current official curriculum at
> [curriculum.gov.bc.ca](https://curriculum.gov.bc.ca). Every item is editable
> in the **Competencies** tab.

Your data is saved automatically to `gradebook-data.json` in your OS user-data
folder (e.g. `%AppData%/BC Gradebook` on Windows,
`~/Library/Application Support/BC Gradebook` on macOS).

---

## Running it

> **New to this?** See **[GETTING_STARTED.md](GETTING_STARTED.md)** for a
> step-by-step, non-technical walkthrough (installing Node, downloading the
> files, launching, and building an installer).

You need [Node.js](https://nodejs.org) installed (LTS is fine).

```bash
npm install     # first time only — downloads Electron
npm start        # launches the app
```

## Building a standalone installer

To produce a double-clickable app you can install without Node:

```bash
npm run build         # builds for your current OS into dist/
npm run build:win     # Windows installer (.exe / NSIS)
npm run build:mac     # macOS disk image (.dmg)
```

> Note: build each platform's installer **on that platform** (build the
> Windows installer on Windows, the Mac one on a Mac) for a signed,
> ready-to-run result.

## Running the tests

```bash
npm test
```

This checks the proficiency-scale mapping and all the grade-weighting math
(assignment, category, and overall calculations, including excused work).

---

## How grades are calculated

1. **Assignment grade** = weighted average of the competency scores you
   entered, over the competencies that have a grade (ungraded ones are
   dropped and the weights renormalized).
2. **Category average** = the mean of the assignment grades in that category
   (excused and ungraded assignments are skipped).
3. **Overall grade** = the category averages weighted by each category's
   weight (categories with no graded work are dropped and remaining weights
   renormalized).

Category weights are *relative* — they don't have to add up to 100.

---

## Project layout

```
main.js              Electron main process + local file storage
preload.js           Safe bridge exposing load/save/export/import
src/
  index.html         App shell
  styles.css         Styling
  renderer.js        All UI logic
  calc.js            Grade & proficiency math (pure, unit-tested)
  bc-curriculum.js   BC subject templates + curricular competencies
test/                Node tests (no dependencies)
```
