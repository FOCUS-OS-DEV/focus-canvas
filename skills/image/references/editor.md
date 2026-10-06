# The editor page

`node "<SKILL>/scripts/editor.mjs" serve <project> --open` starts a local server for the project and opens one tab.
Run it again and it answers with the same page (`reused: true`) instead of opening another. `--fresh` restarts it.
`stop` ends it.

## What the user can do

- **Choose** a piece by clicking it on the stage or in the list on the side. Locked pieces (the original poster,
  the overlay above a wall) let clicks pass through them; they are chosen from the list.
- **Move** by dragging, or with the arrow keys (Shift makes a 10 px step). **Resize** by the corners: images and
  text keep their proportions, a shape resizes freely (Shift keeps proportions). **Rotate** by the circle above the
  piece (Shift snaps to 5 degrees).
- **Panel**: for text the words, the font, size, weight, colour and box width; for a shape the fill and the size;
  for every piece the angle, opacity, shadow (blur, height, strength) and the exact x and y.
- **List**: show or hide a piece, lock it, move it up or down in the stack.
- **Wall**: columns, slot height, gap, corners, opacity and saturation of all photos; click a slot and then a photo
  in the pool to place it (a photo used elsewhere moves here, it never repeats); scroll on a slot to pan the photo
  inside it; drag a column up or down; right-click a slot to empty it; "מילוי של המשבצות הריקות" fills the empty
  slots with unused photos; "ריקון הקיר" clears it. The pool shows every photo of the wall's folder; to add photos,
  ingest them into that folder and the page picks them up on its next refresh.
- **Ctrl+Z** undoes. **שמירה** writes `layers.json` (the previous one goes to `_versions/`). **רינדור** saves and
  writes `renders/current.png`.

## What you do

- Tell the user in one line what to look at, in their words ("תזיז את הסרט לאן שנוח, ותלחץ שמירה").
- When you change `layers.json` yourself (a new layer, a text fix), the page reloads within two seconds, unless the
  user has unsaved changes; then it keeps theirs and you say so.
- After the user saved, read `layers.json` again before you touch it. Their positions are the truth; never put
  back a value you remember.
- The page serves files from the project folder only (`/asset/<relative path>`) and the skill's fonts.
