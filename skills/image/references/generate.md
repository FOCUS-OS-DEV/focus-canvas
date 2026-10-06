# The paid steps

`gen.mjs` runs them and writes every charge to `costs.json` in the project. Quote the price in the plan, from
`node gen.mjs price <step> --n <count>`, and report the real spend after.

| Step | Model | List price | What it is for |
|---|---|---|---|
| `make` | OpenAI gpt-image-2, quality high | $0.25 a picture | a new background, scene, object or character; sizes 1024x1536, 1536x1024, 1024x1024 |
| `edit` | gpt-image-2 edit | $0.25 a picture | an element added to or changed in an existing picture, when the original must not be kept pixel for pixel |
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

## Prompts

- Say what to keep: "Keep everything exactly as it is: the layout, every person, every logo and every word."
- Say the one thing to add, its material and its place: "Add one bold red ribbon with the words SOLD OUT in white
  condensed capitals, across the lower third, slightly tilted, with a soft shadow."
- Never ask the model for Hebrew words. Hebrew is a text layer.
- For a character, name the pose, the light and the lens; for a background, the mood, the colours and where the
  empty area for text should be ("the upper half is calm and dark, for text").

## Keys

`OPENAI_API_KEY` and `FAL_KEY` (or `FALAI_API_KEY`) from the environment, the project's `.env`, or
`~/.focus-canvas/.env`. The user pastes them; you never print them, and a missing key is reported with the file to
put it in.
