# Running & updating BC Gradebook (run-from-source)

You've chosen to **run the app from source**. Because this app has no build
step, updating is as simple as getting the latest code and relaunching — no
reinstalling. This guide sets you up so you barely touch a terminal.

**How it runs:** double-clicking **Start Gradebook** opens the gradebook in your
normal web browser (Safari, Chrome, etc.) using Node.js. It still runs entirely
on your own computer — nothing goes online, and your grades are saved locally.
Running this way needs **no install step** and avoids the macOS "Electron will
damage your computer" warning entirely, because Node is trusted by macOS.

There are two double-click helpers in this folder:

- **Start Gradebook** — launches the app in your browser (`Start
  Gradebook.command` on Mac, `Start Gradebook.bat` on Windows).
- **Update Gradebook** — gets the latest version, then you relaunch
  (`Update Gradebook.command` / `Update Gradebook.bat`).

> A small black **Terminal window** stays open while the app runs — that's
> normal, it's the engine. Keep it open while you work; closing it quits the
> app. Your grades live in a separate folder and are safe either way.

---

## One-time setup

### 1. Install Node.js
Go to **https://nodejs.org**, click the **LTS** button, and run the installer
with all the default options. (This is the engine the app runs on — you never
open it yourself.)

### 2. Get the app with GitHub Desktop (recommended)
GitHub Desktop gives you a friendly button to grab updates later — no terminal,
no passwords to fuss with.

1. Install **GitHub Desktop** from **https://desktop.github.com**.
2. Open it and **sign in** with your GitHub account.
3. **File → Clone repository**, choose **`landonmatties-cpu/gradebook`**, pick a
   folder you'll remember (e.g. Documents), and click **Clone**.

> Prefer not to use GitHub Desktop? You can instead download the code as a ZIP
> from GitHub (green **Code** button → **Download ZIP**) and unzip it — but then
> updating means downloading a fresh ZIP each time. GitHub Desktop is worth the
> five-minute setup.

### 3. First launch
Open the **gradebook** folder and double-click **Start Gradebook**:

- **Windows:** double-click `Start Gradebook.bat`.
- **Mac:** double-click `Start Gradebook.command`. The first time, macOS may ask
  about opening it — **right-click it → Open → Open**. If it says "permission
  denied," open Terminal in the folder once and run:
  `chmod +x "Start Gradebook.command" "Update Gradebook.command"`

A Terminal window opens and your browser pops up with the gradebook. If the
browser doesn't open on its own, go to **http://localhost:4173** yourself.

---

## Every day

Just double-click **Start Gradebook**. Close the window when you're done.

*(Optional nicety — Windows: right-click `Start Gradebook.bat` → Send to →
Desktop (create shortcut). Mac: drag `Start Gradebook.command` to the Dock,
or right-click → Make Alias and move it to the desktop.)*

---

## Getting updates (after I make changes you asked for)

When there's a new version, do **one** of these, then relaunch:

- **With GitHub Desktop (easiest):** open GitHub Desktop, click **Fetch
  origin**, then **Pull origin**. Done. Double-click **Start Gradebook**.
- **With the helper script:** double-click **Update Gradebook**. It pulls the
  latest and refreshes components. Then double-click **Start Gradebook**.

Your grades are **not** affected by updates — see below.

> If an update doesn't seem to appear, make sure GitHub Desktop's **Current
> branch** (top of the window) is set to the branch these changes land on. Ask
> me and I'll tell you which branch to track.

---

## Troubleshooting

**Mac: "Electron will damage your computer."**
You should no longer see this — the **Start Gradebook** launcher now runs the
app in your browser via Node, which macOS trusts, instead of via Electron. If
you *do* see it, you're probably launching the old desktop version (Electron)
rather than double-clicking **Start Gradebook**. Use **Start Gradebook** and
this warning won't appear.

**The browser opens but the page won't load.**
Make sure the small Terminal window is still open (that's the engine). Then
visit **http://localhost:4173** manually. If that port looks busy, the Terminal
window prints the exact address to use — copy it into your browser.

**Prefer the standalone desktop app?** Running `npm start` uses Electron
instead; on an unsigned Mac that triggers the Gatekeeper warning above and needs
an admin/IT exception. Browser mode (**Start Gradebook**) avoids all of that.

---

## Your data is safe

Grades live in a separate folder, **outside** the app, so updates never touch
them:

- **Windows:** `%AppData%\BC Gradebook\`
- **Mac:** `~/Library/Application Support/BC Gradebook/`

For extra safety, use **Export backup** in the app now and then (save it to a
USB stick or cloud folder). You can restore it with **Import backup**, or move
to a new computer with it.

---

## The change loop — asking for new features

As you use it and think of changes:

1. **Jot them down** in one place. The cleanest is **GitHub Issues** on your
   repo (open the repo on GitHub → **Issues** → **New issue**) — a running
   wishlist you can add to anytime, even from your phone. Or just bring the list
   to a session.
2. **Start a Claude Code session** and describe the changes. I'll make them and
   push.
3. **Update** your computer with the steps above, and you're on the new version
   — grades intact.

That's the whole loop: jot → ask → pull → relaunch.
