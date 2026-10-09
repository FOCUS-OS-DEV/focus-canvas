# The first-time setup

Offer it in the opening message, in two lines: what gets installed (two packages and a browser, about 400 MB)
and that it takes a few minutes once. Then:

```
cd "<the folder that holds the repository>"
npm install
npx playwright install chromium
node "<SKILL>/scripts/doctor.mjs" --selftest --write --tools "<every mcp__ tool name you see in this session>"
```

`doctor.mjs` prints what is missing with the command for it, renders the example picture, and under `mcp` says
which MCP servers on this computer make pictures (`imageCapable`), which may (`maybeImageCapable`), and, when
there is none, the offer (`offer`). It prints names and hosts only, never a key. Show the user the example
(`assets/examples/hello/renders/current.png`) and say: `הכול מותקן ועובד. מתחילים.`

## The picture service: an MCP connection, never a key

The skill does not own a way to generate pictures. It uses an MCP server the user connected to Claude Code or
Codex, and only that. No key is asked for, read, printed or stored, in any file, ever. Composing, the editor, the
gate and the exports need no service at all.

What happens, every time a picture needs generating and at setup:

1. **Detect.** `mcp.mjs` reads the MCP configs: for Claude Code `~/.claude.json` (user and local scope) and the
   project's `.mcp.json`; for Codex `~/.codex/config.toml` and `.codex/config.toml`. With `--probe` it also asks
   `claude mcp list` whether each server connects. With `--tools` it confirms a server by the tools of the running
   session, and finds image tools on servers it does not know by name.
2. **Found.** Say so in one line, with the name alone on its own line, and that every picture is quoted before it
   is made:
   ```
   התמונות ייווצרו דרך החיבור שלך לשירות הזה:
   fal
   לפני כל תמונה אני אומר כמה היא עולה ומחכה לאישור.
   ```
   If the server exists but does not connect (`needs-auth`, `failed`), give the step: in Claude Code `/mcp`,
   choose the server, Authenticate in the browser, then a fresh session; in Codex `codex mcp login <name>`.
3. **Several found.** Ask which, default marked: the one that covers the step (cutouts and expanding are verified
   on fal and Replicate).
4. **None found.** The offer below. Then wait.

## The offer

In Hebrew, short, each option with its name alone on its own line and its install line alone on its own line.
The numbers are those `mcp.mjs --offer` prints, with the day they were read. The shape:

```
כדי לייצר תמונות חדשות אני צריך חיבור לשירות תמונות, ולא מצאתי כזה על המחשב.
אפשר להמשיך בלי: הרכבה, עריכה, בדיקות וייצוא עובדים מהחומר שלך בלי שום עלות.
לייצור יש שלוש אפשרויות. בכולן ההתחברות היא דרך הדפדפן, בלי מפתח.

1. המומלץ:
fal
תשלום מראש, בלי מנוי. טוענים כמה דולרים, וכל תמונה יורדת מהיתרה: כ 0.15 דולר לתמונה, חיתוך רקע והרחבה בסנטים.
מכסה כל שלב של הסקיל. שורת ההתקנה:
claude mcp add --transport http --scope user fal https://mcp.fal.ai/mcp-relay
ואז בתוך קלוד קוד מקלידים את הפקודה הזאת, בוחרים את השרת ומאשרים בדפדפן:
/mcp

2.
Replicate
תשלום לפי שימוש, בלי מנוי: יתרה מראש, או חיוב בתחילת כל חודש על מה שנוצל בחודש הקודם. בין 0.025 ל 0.09 דולר לתמונה
לפי המודל. שורת ההתקנה:
claude mcp add replicate https://mcp.replicate.com/sse --transport sse --scope user

3.
Higgsfield
מנוי חודשי עם קרדיטים קבועים: מ 19 דולר לחודש ל 270 קרדיטים, כ 2 קרדיטים לתמונה. דרך החיבור הזה כל תמונה עולה
קרדיטים, גם במסלולים שמציעים "ללא הגבלה" באתר. שורת ההתקנה:
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp

המחירים נקראו מדפי הספקים ב 09.10.2026 ויכולים להשתנות.
ההמלצה: לטעון כמה דולרים בכל פעם ולא יותר, כך שההוצאה נשארת בשליטה.
השימוש והתשלום באחריותך: החשבון, המסלול, הקרדיטים וכל תמונה שנוצרת. אני מצטט לפני כל שלב ומדווח אחריו.
אני לא מתקין כלום בלי אישור ממך: מדביקים את השורה בעצמכם, או אומרים לי להריץ אותה.

איזה מהם, או שנמשיך בינתיים בלי ייצור?
```

For Codex the install lines are these, and the sign-in is `codex mcp login <name>` (Replicate's official Codex
route is the local server with the user's token inside the Codex connection; the skill never sees it, and a user
who wants no token in a file picks fal or Higgsfield):

```
codex mcp add fal --url https://mcp.fal.ai/mcp-relay
codex mcp add higgsfield --url https://mcp.higgsfield.ai/mcp
codex mcp add replicate --env REPLICATE_API_TOKEN=<your token> -- npx -y replicate-mcp@latest
```

## Consent and action

- Nothing is installed by the skill on its own. The user pastes the line, or says to run it; then you run
  exactly that line and nothing else, and show its output.
- The sign-in happens in the user's browser, by the user. You never ask for a code, a token or a password.
- After the sign-in the user starts a fresh session (new MCP tools appear only then). Run `doctor.mjs` again with
  `--tools`, confirm the server by its tools, and go on to the picture.
- "Not now" is a full answer: continue with what needs no service, and offer again only when a step needs it.
- The money rules stay: the plan names the price from the provider, the user says yes, the spend is reported.

## Windows notes

- A machine that blocks npm downloads needs `NODE_OPTIONS=--use-system-ca` for the install; say so when `npm
  install` fails on a certificate.
- The editor page opens with `explorer.exe <url>`; a folder with the final selected opens with `explorer.exe /select,`.
