# Pocket Play

Simple games for kids that work offline. You can install it on a phone's home screen. There are no ads, accounts, links or network calls. It's built from plain HTML, CSS and JavaScript, with no build step.

The first game is **Dot Pop**: connect dots of the same colour to pop them.

## Run locally

The app uses ES modules and a service worker, so it has to be served over HTTP. Opening `index.html` as a file won't work. Any static server will do:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Then open the URL the server prints (for example http://localhost:3000). Service workers are allowed on `localhost` without HTTPS.

To try it on a phone on the same Wi-Fi, open `http://<your-computer's-IP>:<port>`. The service worker and install only work over HTTPS or on localhost, so check offline mode and installing on the deployed site.

## Publish with GitHub Pages

1. Create a new **public** repository on GitHub, for example `pocket-play`. Don't add a README or licence.
2. Push this folder to the `main` branch:

   ```sh
   git init
   git add .
   git commit -m "Pocket Play"
   git branch -M main
   git remote add origin https://github.com/<your-username>/pocket-play.git
   git push -u origin main
   ```

3. On GitHub, open the repository, then go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to *Deploy from a branch*. Then set **Branch** to `main` and the folder to `/ (root)`, and click **Save**.
5. Wait a minute or two. Go back to **Settings → Pages** and you'll see your site's address, which looks like:
   `https://<your-username>.github.io/pocket-play/`

All paths are relative, so the app works from that subpath without any changes.

### Install it on a phone

- **Android (Chrome):** open the site, then choose ⋮ → *Add to Home screen* / *Install app*.
- **iPhone/iPad (Safari):** open the site, then choose Share → *Add to Home Screen*.

Open the app once while you're online. After that it works in airplane mode.

### Publish an update

Installed copies only download new files when `VERSION` in `sw.js` changes (for example `'v1'` → `'v2'`). A Git hook bumps it for you.

**One-time setup, per clone.** Turn on the hook:

```sh
git config core.hooksPath .githooks
```

Then, for each update:

1. Change the files you need to.
2. Commit. If the commit touches app files (`index.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `games/`, `icons/`), the hook bumps `VERSION` and adds that change to the same commit. You'll see `pre-commit: bumped sw.js VERSION v1 -> v2`.
3. Push. GitHub Pages redeploys in about a minute.

Notes:
- Commits that only change docs (like this README or `.gitignore`) don't bump the version, so phones don't re-download for nothing.
- If you change the `VERSION` line yourself in a commit, the hook leaves it alone.
- `git commit --no-verify` skips the hook. If you use it for an app change, bump `VERSION` by hand.
- If you don't see the "bumped" message after an app change, check that the setup command above was run in this clone.

Phones download the new version the next time they open the app while online. If the app is on the picker screen, it reloads on its own. If a game is in progress, it waits until the child goes back to the picker.

## Project layout

```
index.html            app shell (picker + game screen)
manifest.json         PWA manifest
sw.js                 service worker: precache list + VERSION
css/app.css           shell styles
js/app.js             view switching, hold-to-exit, back button, mute, SW registration
js/registry.js        list of games
js/audio.js           synthesised sounds (Web Audio)
games/dots/           Dot Pop: dots.js (logic + rendering), dots.css, themes.js (worlds, MILESTONE)
icons/                app icons (icon.svg is the source)
```

## Add a game

1. Create `games/<id>/` with a module that exports:
   - `start(container, { audio, muted, hud })`: builds the game inside `container`. `hud` is the empty centre slot of the top bar, for a score.
   - `stop()`: removes all listeners, timers, animation frames and DOM.
2. Add an entry to `GAMES` in `js/registry.js`.
3. Add the new files to `PRECACHE` in `sw.js`. Otherwise they won't work offline. The hook bumps `VERSION` when you commit.
