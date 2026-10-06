# The layers file

`layers.json` in the project folder is the picture. Claude writes it, the editor page writes it, `compose.mjs`
renders it. Positions are in pixels of the canvas, from the top left corner. Layers are drawn in order: the first
is at the back.

```json
{
  "name": "aidays-soldout",
  "title": "סולד אאוט AI Days",
  "version": 1,
  "canvas": { "w": 1080, "h": 1440, "platform": "ig-post", "background": "#0a0810" },
  "layers": [
    { "id": "base", "name": "הפוסטר המקורי", "type": "image", "src": "source/photos/poster.jpg",
      "x": 0, "y": 0, "w": 1080, "h": 1440, "fit": "cover", "locked": true, "protect": true },
    { "id": "ribbon", "name": "סרט סולד אאוט", "type": "image", "src": "work/cut/stamp-1.png",
      "x": 131, "y": 943, "w": 829, "h": 258, "rotation": 3.5, "opacity": 1,
      "shadow": { "blur": 26, "x": 0, "y": 12, "alpha": 0.6 } },
    { "id": "title", "name": "כותרת", "type": "text", "text": "סדנה מעשית לפיתוח\nסוכני AI ואוטומציות",
      "font": "Rubik", "weight": 900, "size": 72, "color": "#ffffff", "align": "center",
      "x": 90, "y": 560, "w": 900, "lineHeight": 1.15 }
  ]
}
```

## Every layer

| Property | Meaning |
|---|---|
| `id` | short English id, unique in the file |
| `name` | the Hebrew name the user sees in the list |
| `type` | `image`, `text`, `shape`, `wall` |
| `x`, `y` | top left corner in canvas px |
| `w`, `h` | size in px. An image with no `h` keeps its own proportions |
| `rotation` | degrees, around the centre (not on a wall) |
| `opacity` | 0 to 1 |
| `shadow` | `{ blur, x, y, alpha }`, a drop shadow around the shape of the layer |
| `blend` | a CSS blend mode such as `multiply` or `screen` |
| `locked` | the user cannot drag it on the stage (clicks go through it); still editable from the list |
| `protect` | the user's original, never regenerated; the gate expects it under `source/` |
| `hidden` | drawn nowhere |

## image

`src` relative to the project, `fit` (`cover` or `contain`, used when both `w` and `h` are set), `radius` for
rounded corners. A cutout (PNG with transparency) is an image like any other.

## text

| Property | Meaning |
|---|---|
| `text` | the words, `\n` for a line break; Hebrew is laid right to left by itself |
| `font` | one of the families in `assets/fonts/fonts.json`: Rubik (default), Heebo, Assistant, Fredoka, Frank Ruhl Libre, Playpen Sans Hebrew, Karantina |
| `weight` | 300 to 900 (Karantina has only 700) |
| `size` | px; `lineHeight` (1.2), `letterSpacing` (px), `align` (`center`, `right`, `left`) |
| `w` | the box width; without it the text stays on one line |
| `color` | the fill; `stroke: { width, color }` outlines the letters; `textShadow` is a raw CSS value |
| `background` | `{ color, padding, radius }` draws a box behind the words (a label, a stamp) |
| `italic`, `uppercase` | booleans |

## shape

`shape` (`rect` or `ellipse`), `fill`, `radius`, `border: { width, color }`, with `w` and `h`.

## wall

A photo wall: columns of slots that the user fills from a pool of photos. The slots are computed from the
numbers, so the wall is as editable in the file as in the page.

| Property | Meaning |
|---|---|
| `x`, `y`, `w`, `h` | the area; by default the whole canvas |
| `cols` | columns (4) |
| `slotH` | slot height in px (330); the width follows from the columns and the gap |
| `gap` | px between slots (8); `radius` the corners (14) |
| `offsets` | one vertical shift per column, so the columns are staggered like film strips |
| `pool` | the folder of photos, relative to the project (`source/photos`) |
| `slots` | `{ "col-row": { "photo": "file.jpg", "pan": 0.35 } }`; `pan` 0 shows the top of the photo, 1 the bottom |
| `opacity`, `saturation` | on the whole wall (1 and 1); `empty` the colour of an empty slot |

A wall usually sits at the back, with a shade, a character and the text above it as other layers.
