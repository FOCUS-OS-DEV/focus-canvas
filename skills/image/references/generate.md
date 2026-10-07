# The paid steps

`gen.mjs` runs them and writes every charge to `costs.json` in the project. Quote the price in the plan, from
`node gen.mjs price <step> --n <count>`, and report the real spend after.

| Step | Model | List price | What it is for |
|---|---|---|---|
| `make` | OpenAI gpt-image-2, quality high | $0.25 a picture | a new background, scene, object or character; sizes 1024x1536, 1536x1024, 1024x1024 |
| `edit` | gpt-image-2 edit | $0.25 a picture | an element added to or changed in an existing picture, when the original must not be kept pixel for pixel |
| `make --engine fal` | nano-banana-pro on fal, 2K | $0.15 a picture | the same step on fal: illustrations, scenes, characters; the default when the user has only a fal key |
| `edit --engine fal` | nano-banana-pro edit on fal, 2K | $0.15 a picture | a picture made from one or more reference pictures (`--image a.png,b.png`): the way to keep one style and one character across a series |
| `cut` | BiRefNet v2 on fal | $0.01 a picture | the subject without its background, as a PNG with transparency |
| `expand` | Bria expand on fal | $0.04 a picture | more canvas around a picture (a square poster becomes 3:4); the original pixels are pasted back untouched |

Prices change; the numbers live in `gen.mjs` (`PRICES`) and are the ones quoted. Check the vendor's page when a
project starts after a long pause.

## The recipe that keeps an original untouched

The user has a finished poster and wants a stamp, a ribbon, a badge on it:
1. `edit` the poster with a prompt that asks for ONE new element and nothing else, two takes (`--n 2`).
2. `cut` the new element out of the take you prefer (crop around it first with sharp when the cut takes the whole
   picture).
3. Lay the cutout on the ORIGINAL poster as an image layer with a shadow. The poster is `protect: true`.
4. If the format must grow (1:1 to 3:4), `expand` the original first; the original pixels go back on top by themselves.

## The recipe for a series in one style

A story told in pictures (a carousel, the inserts of a reel) needs the same character, the same room, the same
palette in every picture. Generated one by one from text, they drift. The recipe:
1. `make` ONE anchor picture with the full style in the prompt: the kind of drawing (flat vector, no outlines, long
   soft shadows), the palette by hex, the character with no facial detail, and where the empty area is.
2. Every other picture is `edit --engine fal --image <anchor>` with a prompt that starts "Same character, same room,
   same style and palette as the reference picture" and then says only what changes in this scene.
3. If a picture goes into a video with captions, say "the bottom third of the picture stays dark and empty" in every
   prompt, so the words have their zone.
4. Show the set as one contact sheet before anything is composed; a picture that drifts is remade from the anchor.

## Prompts

- Say what to keep: "Keep everything exactly as it is: the layout, every person, every logo and every word."
- Say the one thing to add, its material and its place: "Add one bold red ribbon with the words SOLD OUT in white
  condensed capitals, across the lower third, slightly tilted, with a soft shadow."
- Never ask the model for Hebrew words. Hebrew is a text layer.
- For a character, name the pose, the light and the lens; for a background, the mood, the colours and where the
  empty area for text should be ("the upper half is calm and dark, for text").

## Keys and engines

`OPENAI_API_KEY` and `FAL_KEY` (or `FALAI_API_KEY`) from the environment, the project's `.env`, or
`~/.focus-canvas/.env`. The user pastes them; you never print them, and a missing key is reported with the file to
put it in. `make` and `edit` run on OpenAI when that key exists and on fal otherwise; `--engine` chooses. When OpenAI
answers that the account has no credits, the tool says so and names `--engine fal`; tell the user in one line and
carry on with fal if they have that key. Cutting and expanding always run on fal.
