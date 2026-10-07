# The first-time setup

Offer it in the opening message, in two lines: what gets installed (two packages and a browser, about 400 MB) and
that it takes a few minutes once. Then:

```
cd "<the folder that holds the repository>"
npm install
npx playwright install chromium
node "<SKILL>/scripts/doctor.mjs" --selftest --write
```

`doctor.mjs` prints what is missing with the command for it, which keys exist, and renders the example picture.
Show the user the example (`assets/examples/hello/renders/current.png`) and say: `הכול מותקן ועובד. מתחילים.`

## Keys

Generating, editing, expanding and cutting pictures need the user's own keys:
- OpenAI (`OPENAI_API_KEY`) for new pictures and edits with gpt-image-2.
- fal (`FAL_KEY`) for cutouts and expanding, and for new pictures and edits with nano-banana-pro (the engine used
  when there is no OpenAI key, or when the OpenAI account has no credits).
One key is enough to start: with fal alone every step works.
Tell the user, once, where to put them: `~/.focus-canvas/.env`, one per line, `NAME=value`. Composing, the editor,
the gate and the exports work without any key. Never print a key, never write it into a project file.

## Windows notes

- A machine that blocks npm downloads needs `NODE_OPTIONS=--use-system-ca` for the install; say so when `npm
  install` fails on a certificate.
- The editor page opens with `explorer.exe <url>`; a folder with the final selected opens with `explorer.exe /select,`.
