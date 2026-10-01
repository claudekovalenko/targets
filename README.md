# Targets

A small installable web app (PWA) for seeing and tracking the targets you're pursuing.

The first target is already loaded: **Preach the Word on Instagram**. It starts January 1, has a 3-posts-per-week rhythm, and comes with launch steps you can edit.

## What it does

- **Targets**: each one has a category, a "why", start and target dates, a weekly rhythm and an optional link (such as your Instagram profile).
- **Steps**: check them off as you go, and the progress bar fills.
- **Activity log**: log each post, sermon or study session, with an optional scripture or topic and a link.
- **Weekly rhythm and streak**: shows this week's count against your rhythm, and how many weeks in a row you've met it.
- **Archive**, **backup export** and **import** are in the ⋮ menu.
- Works offline, and you can install it to your phone's home screen.

Your data is saved on the device you use (browser localStorage). Use **Export backup** to keep a copy or move it to another device.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Put it on your phone

Host the folder on any static host that serves HTTPS, such as GitHub Pages (Settings → Pages → deploy from branch). Then open the URL on your phone and choose **Add to Home Screen** (iPhone: Share menu; Android: the ⋮ menu or the install prompt).
