---
name: image
description: "Focus Canvas by Focus AI Academy: plans, generates and composes finished pictures inside Claude Code, in Hebrew by default. Use this skill whenever the user wants a picture made or changed: a social post, a story, a poster, a cover, an ad image, a sold-out stamp on a poster, a photo wall, a logo or a text laid on a picture, a picture in several sizes. Also when the user says תמונה, פוסט, פוסטר, סטורי, קאבר, באנר, מודעה, לוגו על תמונה, קיר תמונות, לשים טקסט על תמונה, לייצר תמונה, לערוך תמונה, או לפתוח את העורך. The picture is built in layers: what AI generates (through the user's own MCP connection, never an API key), what is cut out, and what code writes exactly (text, logos, shapes). The user fine-tunes every layer in a local editor page and saves; Claude continues from the saved file."
license: Free to use for making images, including commercial ones. The skill itself may not be sold or redistributed. See LICENSE.md in the repository.
compatibility: Claude Code or Codex on Windows or macOS. Needs Node.js 20 or newer. The first-time setup installs two packages and a browser and needs an internet connection once. Generating, cutting and expanding pictures go through an MCP server the user has connected (fal, Replicate or Higgsfield); the skill holds no API key and asks for none.
metadata:
  author: Focus AI Academy
  version: "0.3.0"
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
- **The picture service.** Pictures are generated through an MCP server the user connected to Claude Code or
  Codex, and through nothing else. The skill detects what exists, says which one it will use, and when there is
  none it offers three (fal, Replicate, Higgsfield) with the install line, the price and the terms, and waits.
  The user installs, or says to run the line. No key is ever asked for, read or stored.
- **Money.** Every paid step (generating, editing, expanding, cutting) is quoted before it runs, from the
  provider's own price, and reported after from `costs.json`. Nothing paid runs before the user said yes to the
  plan that names the price. The spend is the user's.
- **Showing.** The editor page, the render and the folder open on the user's screen (`scripts/open.mjs`). One page,
  one tab: the page updates itself; never open a second copy.
- **Brand.** It appears three times in the conversation, as written in that file, and once more in the disclaimer
  of the first run on a computer. It never appears inside the user's picture.

## The flow

Copy this list and track it. A single job (one text on one photo) runs only the steps it needs.

- [ ] 0. Model and effort
- [ ] 1. Setup, the first time only, and the picture service
- [ ] 2. What are we making: the surface, the brief, the material
- [ ] 3. The project folder
- [ ] 4. The plan, with the price
- [ ] 5. Generate, cut, expand (the paid steps, through the MCP connection)
- [ ] 6. Compose
- [ ] 7. The gate
- [ ] 8. The editor page
- [ ] 9. Delivery

### 0. Model and effort

A good picture needs judgment on every layer. If the session runs below the strongest model with high effort, say so
to the user in one line before the plan.

### 1. Setup and the picture service

```
node "<SKILL>/scripts/doctor.mjs" --selftest --write --tools "<every mcp__ tool name you see in this session>"
```
Checks Node, the two packages, the browser and the fonts, renders the example, and under `mcp` says which MCP
servers on this computer make pictures. `missing` carries the install command for each item. `firstRun: true`
means the first run on this computer: the disclaimer of `references/setup.md` comes before any paid step, once.
Details and the offer when no picture server exists: `references/setup.md`. On a later project, when a picture
needs generating, run the detection alone:
```
node "<SKILL>/scripts/mcp.mjs" --tools "<the mcp__ tool names of this session>"
```
Found: say which, in one line. Not connected: give the sign-in step (`/mcp` in Claude Code, `codex mcp login` in
Codex). None: the offer, then wait for the user's choice. Nothing is installed without their yes.

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
the service, and the price of the paid steps as the provider counts it. The price comes from the provider's tool
(`get_pricing` on fal, the model page on Replicate, `get_cost` on Higgsfield). Wait for a clear yes.

### 5. Generate, cut, expand

Through the MCP server's tools, as `references/generate.md` describes per provider: read the tool's schema once
per session, call it, then bring the result into the project and write the charge:
```
node "<SKILL>/scripts/save.mjs" my-picture --url "<result url>" --name bg    --provider fal --model fal-ai/nano-banana-pro --usd 0.15
node "<SKILL>/scripts/save.mjs" my-picture --url "<result url>" --name stamp --kind cut --provider fal --model fal-ai/birefnet/v2 --usd 0.01
node "<SKILL>/scripts/save.mjs" my-picture --url "<result url>" --name ext   --original source/photos/poster.jpg --at 0,180 --provider fal --model fal-ai/bria/expand --usd 0.04
node "<SKILL>/scripts/save.mjs" my-picture put source/photos/poster.jpg --to "<signed upload url>"
node "<SKILL>/scripts/save.mjs" costs my-picture
```
Prompts, what each model is good at, the tool names and parameters of fal, Replicate and Higgsfield, and the recipe
for a stamp or a character that is then cut out and laid on an untouched original: `references/generate.md`.
Hebrew text is never left to the image model: it is a text layer.

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
Say where the files are, what was spent (`save.mjs costs`), and what the user should check before posting.

## Iron rules

1. **The plan names the price, and the user says yes, before any paid step.** Report the spend after.
2. **The user's originals are never regenerated.** A poster, a photo, a logo stays an image layer from `source/`
   with `protect: true`; what is new goes on top. Expanding a picture pastes the original pixels back.
3. **Hebrew text is a text layer, never pixels from an image model.** It is written in code, in a real font,
   right to left, spelled as the user wrote it.
4. **One file is the truth.** `layers.json`. The editor writes it, you read it; you write it, the editor shows it.
   Never keep a second copy of a position in your head or in another file.
5. **The gate runs before the user sees a picture.** A FAIL is fixed first.
6. **Nothing of the brand inside the picture.** The brand appears only in the conversation, three times, and once
   more in the disclaimer of the first run.
7. **Only what the user may use.** Photos, logos and fonts come from the user or from this skill's fonts. Another
   company's logo or a stock photo is never generated as a lookalike.
8. **Numbers and claims on the picture come from the user.** A date, a price, a count is asked, never invented.
9. **Pictures are generated through an MCP connection only.** Never an API key: not asked for, not read from a
   file or the environment, not printed, not stored. The skill says which connection it uses; when there is none
   it offers, with the price and the terms, and the user decides and acts. Nothing is installed without their yes.

## Files

| File | What it holds |
|---|---|
| `references/conversation.md` | the voice, the three brand moments, the picture service, the questions and their defaults |
| `references/platforms.md` | the surfaces, sizes and safe zones |
| `references/plan.md` | the plan message, with an example |
| `references/layers.md` | the layers file: every type and property |
| `references/generate.md` | the paid steps through MCP: the tools of fal, Replicate and Higgsfield, prices with their date, prompts, recipes |
| `references/editor.md` | the editor page: what the user can do, what you do after a save |
| `references/gate.md` | every check of `check.mjs` and how to fix it |
| `references/setup.md` | the first-time setup, the detection of picture servers, the offer and the consent |
| `scripts/` | `project.mjs`, `mcp.mjs`, `save.mjs`, `compose.mjs`, `check.mjs`, `editor.mjs`, `export.mjs`, `open.mjs`, `doctor.mjs` (`gen.mjs` is internal and deprecated, not part of the flow) |
| `assets/fonts/` | seven Hebrew families under the Open Font License |
| `assets/examples/hello/` | the self-test picture |
