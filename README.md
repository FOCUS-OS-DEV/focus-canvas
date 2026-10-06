# Focus Canvas

Focus Canvas by Focus AI Academy: finished pictures built in layers inside Claude Code, in Hebrew.

- AI makes what AI makes well: backgrounds, scenes, a stamp, a character.
- Code writes what has to be exact: Hebrew text in real fonts, logos, shapes, a photo wall.
- Your originals are never regenerated: a poster or a photo stays as it is, and what is new goes on top.
- A local editor page where you click any piece, drag it, resize and rotate it, change the words, fill the photo
  wall slot by slot, and save. Claude continues from what you saved.
- One file is the picture (`layers.json`); the same picture comes out in every size (post, story, square, link image).

## Install

Claude Code, Windows or macOS, Node.js 20 or newer.

```
git clone https://github.com/FOCUS-OS-DEV/focus-canvas
cd focus-canvas && npm install && npx playwright install chromium
```

Then, in Claude Code, add the folder as a plugin (or copy `skills/image` into `~/.claude/skills/`) and say what you
want in Hebrew: "תעשה לי פוסט לאינסטגרם עם סולד אאוט על הפוסטר הזה". The first run checks the computer and shows a
test picture. Generating pictures needs your own OpenAI key; cutting and expanding need a fal key; everything else
works without keys.

## What is inside

`skills/image/SKILL.md` is the skill. `references/` hold the method, `scripts/` the tools, `assets/fonts/` seven
Hebrew families under the Open Font License.

## License

See `LICENSE.md`. Free to use for your pictures, including commercial ones. The skill itself may not be sold or
redistributed.
