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
When it says `firstRun: true`, the disclaimer (below) is shown in this message, once.

## The picture service: an MCP connection, never a key

The skill does not own a way to generate pictures. It uses an MCP server the user connected to Claude Code or
Codex, and only that. No key is asked for, read, printed or stored, in any file, ever. Composing, the editor, the
gate and the exports need no service at all.

What happens, every time a picture needs generating and at setup:

1. **Detect.** `mcp.mjs` reads the MCP configs: for Claude Code `~/.claude.json` (user and local scope) and the
   project's `.mcp.json`; for Codex `~/.codex/config.toml` and `.codex/config.toml`. With `--probe` it also asks
   `claude mcp list` whether each server connects. With `--tools` it confirms a server by the tools of the running
   session, and finds image tools on servers it does not know by name; without it a server is only
   `configured, not verified`. Only fal, Replicate and Higgsfield count; other picture servers are listed under
   `otherImageServers`.
2. **Found.** Say so in one line, with the name alone on its own line, and that every picture is quoted before it
   is made:
   ```
   התמונות ייווצרו דרך החיבור שלך לשירות הזה:
   fal
   לפני כל תמונה אני אומר כמה היא עולה ומחכה לאישור.
   ```
   If the server exists but does not connect (`notConnected`: `not-connected`, `needs-auth`, `failed`), give the step: in Claude Code `/mcp`,
   choose the server, Authenticate in the browser, then a fresh session; in Codex `codex mcp login <name>`.
3. **Several found.** Ask which, default marked: the one that covers the step (cutouts and expanding are verified
   on fal and Replicate).
4. **None found.** The offer below (on the first run, after the disclaimer and its yes). Then wait.

## The offer

In Hebrew, short. Each option has its name alone on its own line, its install line alone on its own line, the
sign-in step after it, and its billing page (`billing` in `mcp.mjs --offer`) alone on its own line after
`טעינת יתרה:`. The numbers are those `mcp.mjs --offer` prints, with the day they were read. The shape:

```
כדי לייצר תמונות חדשות אני צריך חיבור לשירות תמונות, ולא מצאתי כזה על המחשב.
אפשר להמשיך בלי: הרכבה, עריכה, בדיקות וייצוא עובדים מהחומר שלך בלי שום עלות.
לייצור יש שלוש אפשרויות. בכולן ההתחברות היא דרך הדפדפן, בלי מפתח.

1. המומלץ. תשלום מראש, בלי מנוי:
fal
טוענים כמה דולרים, וכל תמונה יורדת מהיתרה: כ 0.15 דולר לתמונה, חיתוך רקע והרחבה בסנטים.
מכסה כל שלב של הסקיל. שורת ההתקנה:
claude mcp add --transport http --scope user fal https://mcp.fal.ai/mcp-relay
ואז בתוך קלוד קוד מקלידים את הפקודה הזאת, בוחרים את השרת ומאשרים בדפדפן:
/mcp
טעינת יתרה:
https://fal.ai/dashboard/usage-billing/billing

2. תשלום לפי שימוש:
Replicate
בלי מנוי. יתרה מראש, או חיוב בתחילת כל חודש על מה שנוצל בחודש הקודם. בין 0.025 ל 0.09 דולר לתמונה
לפי המודל. שורת ההתקנה:
claude mcp add replicate https://mcp.replicate.com/sse --transport sse --scope user
ואז בתוך קלוד קוד מקלידים את הפקודה הזאת, בוחרים את השרת, נכנסים לחשבון בדפדפן ומאשרים:
/mcp
טעינת יתרה:
https://replicate.com/account/billing

3. מנוי חודשי:
Higgsfield
קרדיטים קבועים בכל חודש: מ 19 דולר לחודש ל 270 קרדיטים, כ 2 קרדיטים לתמונה. דרך החיבור הזה כל תמונה עולה
קרדיטים, גם במסלולים שמציעים "ללא הגבלה" באתר. שורת ההתקנה:
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
ואז בתוך קלוד קוד מקלידים את הפקודה הזאת, בוחרים את השרת ונכנסים לחשבון בדפדפן:
/mcp
טעינת יתרה:
https://higgsfield.ai/pricing

המחירים נקראו מדפי הספקים ב 09.10.2026 ויכולים להשתנות.
ההמלצה: לטעון כמה דולרים בכל פעם ולא יותר, כך שההוצאה נשארת בשליטה.
אני לא מתקין כלום בלי אישור ממך: מדביקים את השורה בעצמכם, או אומרים לי להריץ אותה.

איזה מהם, או שנמשיך בינתיים בלי ייצור?
```

The billing pages were checked on 2026-10-11: fal and Replicate open their sign-in first and then the billing page;
Higgsfield's is its plans page.

For Codex the install lines are these. Under fal and Higgsfield the sign-in line is `codex mcp login <name>` in place
of `/mcp`; Replicate's official Codex route is the local server with the user's token inside the Codex connection,
with no sign-in line (the skill never sees the token, and a user who wants no token in a file picks fal or
Higgsfield):

```
codex mcp add fal --url https://mcp.fal.ai/mcp-relay
codex mcp add higgsfield --url https://mcp.higgsfield.ai/mcp
codex mcp add replicate --env REPLICATE_API_TOKEN=<your token> -- npx -y replicate-mcp@latest
```

## The disclaimer, once

On the first run of the skill on this computer, the run that does the setup (`firstRun: true` in the output of
`doctor.mjs`), show this before any paid step, on both paths: a picture server was found, or the offer is shown.
Word for word, each sentence on its own line:

```
לפני שמתחילים, כמה מילים על אחריות:
החשבון אצל שירות התמונות הוא שלך ובכפוף לתנאים שלו. הספק גובה ישירות כל חיוב, מנוי או קרדיט, והאחריות עליהם שלך בלבד.
אני אומר מחיר לפני כל שלב בתשלום, אבל המחיר הקובע הוא של הספק ביום החיוב.
התוצאה של מודל AI לא מובטחת, וגם ניסיון שלא יצא טוב עולה כסף.
הזכויות בכל חומר שנכנס לתמונה, כמו צילומים, לוגואים ואנשים, והאחריות על מה שמתפרסם, הן שלך.
הסקיל ניתן כמו שהוא, ו Focus AI Academy לא אחראית להוצאות אצל הספקים, לתוצאות, לזכויות בחומרים או לשימוש בתמונות.
ממשיכים?
```

- **Where.** In the message after the setup, after `הכול מותקן ועובד. מתחילים.`. When a picture server was found,
  its line comes first and the disclaimer closes the message. When none was found, the disclaimer closes the
  message and the offer comes after the yes, so the user reads it before choosing a provider and loading money.
- **The answer.** A yes continues. This is the moment the user reads the terms, and it is not a legal acceptance:
  ask nothing more about it. A question gets a plain answer; nothing paid runs before the yes.
- **Once.** `doctor.mjs --write` keeps `setupDone` in `~/.focus-canvas/state.json`, and every later run says
  `firstRun: false`: the disclaimer is not shown again, on any project. It names Focus AI Academy, a fourth mention
  of the brand allowed by `references/conversation.md`.

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
