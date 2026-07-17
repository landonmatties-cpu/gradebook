# Getting Started — installing and launching BC Gradebook

This guide is written for someone who has **never used a code editor or a
terminal before**. Follow it top to bottom. It takes about 10–15 minutes the
first time; after that, opening the app is a couple of clicks.

There are two ways to use the app:

- **Option A — Run it with Node** (simplest to get going, works on Windows and
  Mac). You start the app by double-clicking a small file each time.
- **Option B — Build a real installer** (a proper `.exe` on Windows or `.dmg`
  on Mac) so you can install it like any normal app and forget about Node.

Start with **Option A**. You can always do Option B later.

---

## Step 1 — Install Node.js (one time)

Node.js is the free engine the app runs on.

1. Go to **https://nodejs.org**
2. Click the big button that says **"LTS"** (Recommended For Most Users).
3. Open the file it downloads and click **Next / Continue / Agree** through the
   installer, leaving every setting at its default. Then **Finish**.

That's it — you don't ever open Node yourself; the app uses it in the
background.

> **How do I know it worked?** You don't need to check, but if you want to:
> - **Windows:** press the Start button, type `cmd`, press Enter, then type
>   `node --version` and press Enter. You should see a version number like
>   `v20.x.x`.
> - **Mac:** open **Terminal** (press `Cmd + Space`, type `Terminal`, Enter),
>   type `node --version`, press Enter. You should see a version number.

---

## Step 2 — Download the app's files

You have the app's code in a GitHub repository. Download it as a folder:

1. In your web browser, open the repository page on **GitHub**.
2. Make sure the branch selector (near the top-left of the file list) shows
   the branch **`claude/bc-gradebook-app-gdedc5`**. Click it and choose that
   branch if it isn't already selected.
3. Click the green **`< > Code`** button.
4. Click **Download ZIP**.
5. Find the downloaded ZIP file (usually in your **Downloads** folder) and
   **unzip it**:
   - **Windows:** right-click the ZIP → **Extract All** → **Extract**.
   - **Mac:** double-click the ZIP.
6. You now have a folder named something like **`gradebook`**. Move it
   somewhere you'll remember, like your **Documents** folder.

---

## Step 3 — Open a terminal *in that folder*

This sounds scary but it's just a text window where you type two commands. The
trick is opening it **inside the gradebook folder**.

### Windows

1. Open the **gradebook** folder in File Explorer so you can see the files
   inside it (`main.js`, `package.json`, a `src` folder, etc.).
2. Click once in the **address bar** at the top (where the folder path is),
   type `cmd`, and press **Enter**.
3. A black window opens, already pointing at your folder. 

### Mac

1. Open the **gradebook** folder in Finder.
2. Right-click (or Control-click) the **gradebook** folder itself.
3. Choose **New Terminal at Folder**.
   - If you don't see that option: open **Terminal**, type `cd ` (with a
     space after `cd`), then drag the gradebook folder from Finder into the
     Terminal window, and press **Enter**.

---

## Step 4 — Install the app's parts (one time)

In that terminal window, type this and press **Enter**:

```
npm install
```

You'll see a lot of text scroll by — that's normal. It's downloading the app's
building blocks (mostly a component called Electron). Wait until it stops and
you get your cursor back (usually 1–3 minutes). You only ever do this once.

> If you see warnings in yellow, ignore them. Only stop if you see the word
> **`error`** in red — if that happens, see **Troubleshooting** below.

---

## Step 5 — Launch the app

Still in the same terminal window, type:

```
npm start
```

Press **Enter**, and the **BC Gradebook** window opens. 🎉

Create your first class with the **+ Add Class** button, pick a BC subject to
pre-fill its curricular competencies (or start blank), and you're off.

**To close the app:** just close the window. You can also close the terminal.

---

## Opening the app next time

You don't repeat Steps 1, 2, and 4. Each time you want the app:

1. Open a terminal **in the gradebook folder** (Step 3).
2. Type `npm start` and press Enter.

### Make it a one-click shortcut (optional but nice)

So you don't touch the terminal at all:

- **Windows:** in the gradebook folder, right-click → **New → Text Document**.
  Open it, paste the line below, then **Save As** → change the name to
  `Start Gradebook.bat` and set "Save as type" to **All Files**. Double-click
  that `.bat` file any time to launch the app.
  ```
  npm start
  ```
- **Mac:** the cleanest path is **Option B** below, which gives you a real app
  icon in Applications.

---

## Option B — Build a proper installer (optional)

This turns the app into a normal installable program so you never need the
terminal again. **Do this on the same kind of computer you want to run it on**
(build the Windows version on Windows, the Mac version on a Mac).

In a terminal in the gradebook folder (after you've done Step 4 once):

- **Windows:**
  ```
  npm run build:win
  ```
  When it finishes, open the new **`dist`** folder — you'll find a **BC
  Gradebook Setup** `.exe`. Run it to install the app into your Start menu.

- **Mac:**
  ```
  npm run build:mac
  ```
  When it finishes, open the **`dist`** folder and open the **BC Gradebook**
  `.dmg`. Drag the app into your **Applications** folder. Launch it from
  Launchpad or Applications like any other app.

> On Mac, the first time you open a self-built app, macOS may say it "cannot
> verify the developer." Right-click the app → **Open** → **Open** to allow it.
> This is because the app isn't signed with a paid Apple developer certificate;
> it's still your own app running locally.

---

## Where your grades are stored (and backups)

Your data is saved automatically as you work, in a file called
`gradebook-data.json` inside your computer's app-data folder:

- **Windows:** `%AppData%\BC Gradebook\`
- **Mac:** `~/Library/Application Support/BC Gradebook/`

You don't need to touch that. For safety, use the **Export backup** button in
the app's sidebar now and then to save a copy anywhere you like (a USB stick,
your Documents, cloud storage). **Import backup** restores it — handy for
moving to a new computer.

---

## Troubleshooting

**"`npm` is not recognized" / "command not found: npm"**
Node didn't install, or the terminal was open before you installed it. Close
the terminal, redo **Step 1**, restart your computer, then try again.

**The terminal shows red `error` text during `npm install`**
Usually a temporary internet hiccup. Check your connection and run
`npm install` again. If you're on a **school/district network**, it may block
downloads — try from home internet, or ask IT to allow `registry.npmjs.org`.

**`npm start` prints text but no window appears**
Give it a few seconds. If nothing opens, close the terminal, reopen it in the
folder, and run `npm start` again.

**I moved the folder and now it won't start**
That's fine — just open the terminal in the folder's **new** location
(Step 3) and run `npm start`. If you moved it right after downloading and
hadn't run `npm install` yet, run that first.

**How do I update the app later?**
Download the latest ZIP again (Step 2), unzip it, and run `npm install` then
`npm start` in the new folder. Your grades stay safe in the app-data folder
above — but exporting a backup first never hurts.
