# The gate

`node "<SKILL>/scripts/check.mjs" <project>` reads `layers.json` and `renders/current.png`. Exit 0 when nothing
fails. A FAIL is fixed before the user sees the picture; a WARN is said to the user in one line, with what you did
about it.

| Check | Level | What it means | The fix |
|---|---|---|---|
| `render` | FAIL | no render yet | `compose.mjs` |
| `size` | FAIL | the render is not the canvas size | compose again |
| `missing-file` | FAIL | an image or a wall photo is not on disk | fix the path, or ingest the file |
| `text-size` | FAIL | a text smaller than 2.6% of the width (28 px at 1080) | bigger, or fewer words |
| `safe-zone` | WARN | a text outside the platform's safe zone | move it in |
| `contrast` | WARN | the text colour against what the render shows behind it reads under 2.5 | a box behind the words, a stroke, a darker shade layer, or another spot |
| `hebrew-hyphen` | WARN | a hyphen between two Hebrew words | a comma, a period or a line break |
| `spaces` | WARN | double spaces | one space |
| `off-canvas` | WARN | a text or a shape reaches outside the picture | move or shrink it |
| `protect` | WARN | a protected layer does not come from `source/` | the original belongs in `source/`, generated takes in `work/` |
| `oversize` | WARN | an image much wider than the picture | check that it is meant to bleed |
| `wall-repeat` | WARN | the same photo twice on the wall | replace one |
| `wall-empty` | WARN | empty slots on the wall | fill them, or let the shade cover them on purpose |

Before the gate, look at the render yourself: a stamp that covers a face, a text that touches a logo, a wall where
the same person appears three times. The gate measures; you judge.
