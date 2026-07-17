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
- **Multiple sections of the same subject.** e.g. "Math 8 — Block A" and
  "Math 8 — Block D" are separate classes with their own students and grades.
- **Easy assignments.** An assignment is just a **title** + the **curricular
  competencies** it assesses (chosen from a checklist). Give each competency a
  **weight**, and the overall assignment grade is **generated automatically**
  as the weighted average.
- **Number-based grade entry.** Type `1`–`8` per competency; the matching
  proficiency level is shown live.
- **Categories with weights.** Create categories (Quizzes, Projects, Homework,
  Tests…) and set each one's weight toward the overall grade.
- **Excuse individual students** from any assignment — excused work is left
  out of that student's averages.
- **Automatic overall grade** per student: weighted across categories, with
  empty/excused work correctly dropped and weights renormalized.
- **Backups.** Export/import your whole gradebook as a JSON file.

Your data is saved automatically to `gradebook-data.json` in your OS user-data
folder (e.g. `%AppData%/BC Gradebook` on Windows,
`~/Library/Application Support/BC Gradebook` on macOS).

---

## Running it

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
