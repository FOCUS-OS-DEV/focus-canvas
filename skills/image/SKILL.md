---
name: image
description: "Focus Canvas by Focus AI Academy: plans, generates and composes finished pictures inside Claude Code, in Hebrew by default. Use this skill whenever the user wants a picture made or changed: a social post, a story, a poster, a cover, an ad image, a sold-out stamp on a poster, a photo wall, a logo or a text laid on a picture, a picture in several sizes. Also when the user says תמונה, פוסט, פוסטר, סטורי, קאבר, באנר, מודעה, לוגו על תמונה, קיר תמונות, לשים טקסט על תמונה, לייצר תמונה, לערוך תמונה, או לפתוח את העורך. The picture is built in layers: what AI generates, what is cut out, and what code writes exactly (text, logos, shapes). The user fine-tunes every layer in a local editor page and saves; Claude continues from the saved file."
license: Free to use for making images, including commercial ones. The skill itself may not be sold or redistributed. See LICENSE.md in the repository.
compatibility: Claude Code on Windows or macOS. Needs Node.js 20 or newer. The first-time setup installs two packages and a browser and needs an internet connection once. Generating and cutting pictures needs the user's own OpenAI and fal keys.
metadata:
  author: Focus AI Academy
  version: "0.1.0"
---

# Focus Canvas

Focus Canvas turns Claude Code into a designer who works in layers. You plan the picture with the user, let AI make
what AI makes well (backgrounds, scenes, a stamp, a character), cut out what has to float, write in code what has to be
exact (Hebrew text, logos, shapes, a photo wall), and show the result in a page where the user moves, resizes and
rotates every piece, fills the wall, and saves. The saved file is the truth: you continue from it. It is made by
Focus AI Academy.

`<SKILL>` below is the folder that holds this file. Every tool runs as `node "<SKILL>/scripts/<name>.mjs"` and prints
one JSON line. Run a tool with `--help` to see its options.

## How to work with the user

Read `references/conversation.md` once per conversation. In short:
- **Language.** Plain Hebrew, short sentences, no technical terms. "Layer" is שכבה, "render" is רינדור, that is all.
- **Partner.** The user takes part at a few points where their choice matters: the plan, the picture candidates,
  the editor. Every question has a default, and "תמשיך" always works.
- **Money.** Every paid step (generating, editing, expanding, cutting) is quoted before it runs and reported after.
  Nothing paid runs before the user said yes to the plan that names the price.
- **Showing.** The editor page, the render and the folder open on the user's screen (`scripts/open.mjs`). One page,
  one tab: the page updates itself; never open a second copy.
- **Brand.** It appears three times in the conversation, as written in that file. It never appears inside the
  user's picture.

## The flow

Copy this list and track it. A single job (one text on one photo) runs only the steps it needs.

- [ ] 0. Model and effort
- [ ] 1. Setup, the first time only
- [ ] 2. What are we making: the surface, the brief, the material
- [ ] 3. The project folder
- [ ] 4. The plan, with the price
- [ ] 5. Generate, cut, expand (the paid steps)
- [ ] 6. Compose
- [ ] 7. The gate
- [ ] 8. The editor page
- [ ] 9. Delivery

### 0. Model and effort

A good picture needs judgment on every layer. If the session runs below the strongest model with high effort, say so
to the user in one line before the plan.

### 1. Setup

```
node "<SKILL>/scripts/doctor.mjs" --selftest
```
Checks Node, the two packages, the browser and the fonts, says which keys exist, and renders the example. `missing`
carries the install command for each item. Keys go in `~/.focus-canvas/.env` as `OPENAI_API_KEY=` and `FAL_KEY=`;
the user pastes them there, you never print them. Details: `references/setup.md`.

### 2. What are we making

If the request already says it, do not ask. Otherwise one question with the surfaces in `references/platforms.md`
(post, story, square, poster, link image) and the material the user has: photos, a logo, a design to keep, a brand
colour. The user's material always wins over generated material: a real poster is kept as it is and only gets
what is new on top (`protect: true`).

### 3. The project folder

```
node "<SKILL>/scripts/project.mjs" init my-picture --platform ig-post --title "..."
node "<SKILL>/scripts/project.mjs" ingest my-picture "C:/photos" "C:/brand/logo.png"
```
`source/` holds what the user brought, `work/` what was generated or cut, `renders/` the current picture,
`exports/` the sizes, `_versions/` every earlier layers file. `layers.json` is the picture. Schema: `references/layers.md`.

### 4. The plan

One message before anything is built or paid (`references/plan.md`): what the picture says, every word that will
appear on it with its exact spelling, which layers AI makes and which code writes, what is kept untouched, the sizes,
and the price of the paid steps in dollars. Wait for a clear yes.

### 5. Generate, cut, expand

```
node "<SKILL>/scripts/gen.mjs" price make --n 2
node "<SKILL>/scripts/gen.mjs" make   my-picture --prompt "..." --n 2 --name bg
node "<SKILL>/scripts/gen.mjs" edit   my-picture --image source/photos/poster.jpg --prompt "..." --name stamp
node "<SKILL>/scripts/gen.mjs" cut    my-picture --image work/gen/stamp-1.png --name stamp
node "<SKILL>/scripts/gen.mjs" expand my-picture --image source/photos/poster.jpg --to 1080x1440
```
Prompts, what each model is good at, and the recipe for a stamp or a character that is then cut out and laid on an
untouched original: `references/generate.md`. Hebrew text is never left to the image model: it is a text layer.

### 6. Compose

Write `layers.json`, then:
```
node "<SKILL>/scripts/compose.mjs" my-picture
```
`renders/current.png` is pixel for pixel what the editor shows. Look at it before the gate (`open.mjs`, or describe
it from the frame if the session cannot open windows).

### 7. The gate

```
node "<SKILL>/scripts/check.mjs" my-picture
```
Text inside the safe zone of the platform, readable size, contrast against what is behind it, no hyphen between
Hebrew words, no missing file, no photo twice on a wall, no empty slot. A FAIL is fixed before the user sees the
picture; a WARN is said in one line. Rules: `references/gate.md`.

### 8. The editor page

```
node "<SKILL>/scripts/editor.mjs" serve my-picture --open
```
The user clicks a piece, drags it, resizes it by the corners, rotates it by the circle, moves it with the arrows;
changes text, font, size, colour, shadow and opacity in the panel; on a photo wall clicks a slot and then a photo,
scrolls to pan it, drags a column, right-clicks to empty a slot. "שמירה" writes `layers.json`; "רינדור" writes the
picture. When you change `layers.json` yourself the page updates in place. After the user saved, read `layers.json`
again and continue from it. Details: `references/editor.md`.

### 9. Delivery

```
node "<SKILL>/scripts/compose.mjs" my-picture --bump          the numbered final, my-picture-v1.png
node "<SKILL>/scripts/export.mjs"  my-picture --to ig-story,square --jpg
node "<SKILL>/scripts/open.mjs"    my-picture --select
```
Say where the files are, what was spent (from `costs.json`), and what the user should check before posting.

## Iron rules

1. **The plan names the price, and the user says yes, before any paid step.** Report the spend after.
2. **The user's originals are never regenerated.** A poster, a photo, a logo stays an image layer from `source/`
   with `protect: true`; what is new goes on top. Expanding a picture pastes the original pixels back.
3. **Hebrew text is a text layer, never pixels from an image model.** It is written in code, in a real font,
   right to left, spelled as the user wrote it.
4. **One file is the truth.** `layers.json`. The editor writes it, you read it; you write it, the editor shows it.
   Never keep a second copy of a position in your head or in another file.
5. **The gate runs before the user sees a picture.** A FAIL is fixed first.
6. **Nothing of the brand inside the picture.** The brand appears only in the conversation, three times.
7. **Only what the user may use.** Photos, logos and fonts come from the user or from this skill's fonts. Another
   company's logo or a stock photo is never generated as a lookalike.
8. **Numbers and claims on the picture come from the user.** A date, a price, a count is asked, never invented.

## Files

| File | What it holds |
|---|---|
| `references/conversation.md` | the voice, the three brand moments, the questions and their defaults |
| `references/platforms.md` | the surfaces, sizes and safe zones |
| `references/plan.md` | the plan message, with an example |
| `references/layers.md` | the layers file: every type and property |
| `references/generate.md` | the paid steps: models, prices, prompts, recipes |
| `references/editor.md` | the editor page: what the user can do, what you do after a save |
| `references/gate.md` | every check of `check.mjs` and how to fix it |
| `references/setup.md` | the first-time setup and the keys |
| `scripts/` | `project.mjs`, `gen.mjs`, `compose.mjs`, `check.mjs`, `editor.mjs`, `export.mjs`, `open.mjs`, `doctor.mjs` |
| `assets/fonts/` | seven Hebrew families under the Open Font License |
| `assets/examples/hello/` | the self-test picture |
