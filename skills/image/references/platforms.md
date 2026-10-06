# Surfaces

| Key | Size | Safe zone (top / bottom / left / right) | For |
|---|---|---|---|
| `ig-post` | 1080 x 1440 | 60 / 60 / 60 / 60 | Instagram feed post, 3:4, the default |
| `ig-post-45` | 1080 x 1350 | 60 / 60 / 60 / 60 | Instagram feed post, 4:5 |
| `square` | 1080 x 1080 | 60 / 60 / 60 / 60 | square: Instagram, WhatsApp, a profile |
| `ig-story` | 1080 x 1920 | 250 / 360 / 80 / 80 | story and reel cover; the platform's buttons sit at the top and the bottom |
| `linkedin` | 1200 x 627 | 40 / 40 / 60 / 60 | LinkedIn link image |
| `facebook` | 1200 x 630 | 40 / 40 / 60 / 60 | Facebook link image |
| `a4-poster` | 1240 x 1754 | 80 / 80 / 80 / 80 | A4 at 150 dpi, for print proofs |

`project.mjs init --size WxH` makes any other size (`platform: custom`, safe zone 40 px).

The safe zone is where text and logos stay; backgrounds, walls and shades fill the whole picture. `check.mjs` warns
on text outside it. `export.mjs --to` makes the other sizes from the same layers: full-canvas layers stretch to cover,
the rest keep their relative centre and scale by the smaller ratio. Look at every export; a story usually needs the
text moved up a little by hand in the editor.
