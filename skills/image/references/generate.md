# The paid steps: through an MCP connection, never a key

A new picture, an edit from references, a cutout and an expanded canvas are made by an MCP server the user has
connected to Claude Code or Codex. This skill holds no API key, never asks for one, never reads one. Composing,
the editor, the gate and the exports run on the user's computer and cost nothing.

## Before any paid step

1. **Which server.** `node "<SKILL>/scripts/mcp.mjs" --tools "<every mcp__ tool name you see in this session>"`
   (`doctor.mjs` runs the same at setup). It reads the MCP configs of Claude Code and Codex, names the servers that
   make pictures, and prints nothing but names and hosts. Known providers: fal, Replicate, Higgsfield, and only
   they count (`imageCapable`), since only their prices are known. Another server with picture tools (Canva,
   Cloudinary) is listed under `otherImageServers` and is not used for the paid steps.
2. **None:** the offer, in `references/setup.md`. Nothing is installed and nothing is paid without the user's
   yes. **Several:** ask which one, with the default marked: the one that covers the step. Cutouts and expanding
   are verified on fal and Replicate only.
3. **Not connected yet** (`notConnected`, `status: not-connected`, `needs-auth` or `failed`): tell the user the step, in their words: in Claude Code
   `/mcp`, choose the server, Authenticate in the browser, then a fresh session. In Codex `codex mcp login <name>`.
4. **The schema first.** Once per session and provider, read the server's tool list and the input schema of the
   tool you will call (fal `get_model_schema`, Replicate `get_models`, Higgsfield the tool's own schema). Never call
   a tool whose schema you have not seen in this session; the tables below say what was true on 2026-10-09.
5. **The price, then the yes.** Ask the provider (fal `get_pricing`; Replicate the model page; Higgsfield the
   `get_cost` preflight when the schema has it, else the credits of the plan). Put it in the plan. Run only after
   the user said yes to that plan. After the step, `save.mjs` writes the charge to `costs.json`; say the spend in
   one line. A take that was billed and gave no picture is written too (`--charge-only`).

## The result file

A result arrives as a URL (fal CDN, `replicate.delivery`) or, on some servers, as inline data. It comes into the
project with `save.mjs`, which also writes the charge:

```
node "<SKILL>/scripts/save.mjs" my-picture --url "<result url>" --name bg --provider fal --model fal-ai/nano-banana-pro --usd 0.15
node "<SKILL>/scripts/save.mjs" my-picture --url "<result url>" --name stamp --kind cut --provider fal --model fal-ai/birefnet/v2 --usd 0.01
node "<SKILL>/scripts/save.mjs" my-picture --url "<result url>" --name ext --original source/photos/poster.jpg --at 0,180 --provider fal --model fal-ai/bria/expand --usd 0.04
node "<SKILL>/scripts/save.mjs" my-picture --b64 work/tmp/result.txt --name bg --provider higgsfield --model nano_banana_pro --credits 2
node "<SKILL>/scripts/save.mjs" my-picture --charge-only --provider fal --model fal-ai/nano-banana-pro --usd 0.15 --notes "take failed, billed"
node "<SKILL>/scripts/save.mjs" costs my-picture
```

`--original --at x,y` is the expand step: the original pixels are pasted back on top, so nothing of them is
regenerated. `--usd` or `--credits` is the price the user approved in the plan, written as given; the tool
estimates nothing. Files land in `work/gen/` (`--kind cut`: `work/cut/`) under the next free name.

## Sending the user's picture to a provider

A server cannot read the user's disk. For an edit, a cutout or an expand the picture travels first:
- **fal**: `upload_file` with `prepare_upload: true`, `file_name`, `file_size` returns a signed `upload_url` and
  the final `file_url`. Send the bytes: `node "<SKILL>/scripts/save.mjs" put source/photos/poster.jpg --to "<upload_url>"`.
  Then use `file_url` as `image_url` / `image_urls`. A fal CDN URL is public, so it serves Replicate and
  Higgsfield as well, when the user has fal too.
- **Replicate**: `create_files` exists in the tool list; its input over MCP is read at runtime. Otherwise a
  public URL, or for a small picture a `data:image/png;base64,...` string in `input`.
- **Higgsfield**: reference pictures go in the `medias` / image-references field of `generate_image`; whether it
  takes a URL only or also data is read from the schema.

## fal (official docs read 2026-10-09)

Server `https://mcp.fal.ai/mcp-relay`, OAuth in the browser, no key. Billing is standard fal pricing for what
is generated; the MCP itself costs nothing. Tools and parameters:

| Tool | Parameters | Notes |
|---|---|---|
| `search_models` | `query`, `category`, `limit`, `cursor` (all optional) | find an endpoint id |
| `get_model_schema` | `endpoint_id` | the input and output schema, read before the first call |
| `get_pricing` | `endpoint_id` (one, or comma separated up to 50) | the price to quote in the plan |
| `recommend_model` | `task` | a suggestion by task |
| `run_model` | `endpoint_id`, `input`, `expiration_seconds?`, `store_payload?` | waits up to 45 s; returns the result, or `request_id` when still running |
| `submit_job` | `endpoint_id`, `input`, `expiration_seconds?`, `store_payload?` | returns `request_id` at once |
| `check_job` | `endpoint_id`, `request_id`, `status_url?` | the status |
| `get_job_result` | `endpoint_id`, `request_id`, `response_url?` | the result |
| `cancel_job` | `endpoint_id`, `request_id`, `cancel_url?` | |
| `upload_file` | `prepare_upload`, `file_size`, `file_name`, `url`, `data` (base64) | a signed upload for a local file, a public `url`, or small base64 `data`; returns `cdn_url` / `file_url` |
| `search_docs` | `query` | fal's documentation |

The endpoints this skill used before 0.3.0, with the inputs that worked then (confirm with `get_model_schema`):

| Step | `endpoint_id` | `input` | Result |
|---|---|---|---|
| make | `fal-ai/nano-banana-pro` | `prompt`, `aspect_ratio`, `resolution: "2K"`, `num_images`, `output_format: "png"` | `images[].url` |
| edit, series from references | `fal-ai/nano-banana-pro/edit` | the same plus `image_urls: [...]` | `images[].url` |
| cut | `fal-ai/birefnet/v2` | `image_url`, `model: "General Use (Heavy)"`, `operating_resolution: "2048x2048"`, `output_format: "png"`, `refine_foreground: true` | `image.url` |
| expand | `fal-ai/bria/expand` | `image_url`, `canvas_size: [W, H]`, `original_image_size: [w, h]`, `original_image_location: [x, y]`, `prompt?` | `image.url`, then `save.mjs --original --at x,y` |

Aspect ratio by surface: `ig-post` 3:4, `ig-post-45` 4:5, `square` 1:1, `ig-story` 9:16, `linkedin` and
`facebook` 16:9 (then `fit: cover`), `a4-poster` 3:4. Hebrew words are never in the prompt: they are a text layer.

## Replicate (official page and the replicate-mcp README read 2026-10-09)

Remote server `https://mcp.replicate.com/sse` (Claude Code, OAuth in the browser) or the local `npx -y
replicate-mcp@latest` (Codex, the token inside the Codex connection). The tool names come from the package's
README; the remote server may expose the same names, or the three dynamic tools (`list_api_endpoints`,
`get_api_endpoint_schema`, `invoke_api_endpoint`). Read the list at runtime.

| Tool | Parameters | Notes |
|---|---|---|
| `search_models` | a query | find a model, e.g. `google/nano-banana-pro`, a background remover, an outpainting model |
| `get_models` | `model_owner`, `model_name` | the model, its latest version and its input schema; the price is on the model page |
| `create_models_predictions` | `model_owner`, `model_name`, `input` | run the latest version of a model |
| `create_predictions` | `version`, `input` | run a pinned version; the `Prefer: wait` header waits up to 60 s |
| `get_predictions` | `prediction_id` | poll until `status: succeeded`; `output` holds the URL or a list of URLs |
| `create_files`, `get_files`, `download_files` | | the files API; its MCP shape is read at runtime |
| `get_account` | | who is signed in |

Outputs are `https://replicate.delivery/...` URLs, public for a while: fetch them with `save.mjs --url` right
away. `google/nano-banana-pro` takes `prompt`, `image_input` (a list of URLs), `aspect_ratio`, `resolution`,
`output_format`; read the exact enums from the schema.

## Higgsfield (NOT verified against an official page; read the tool list at runtime)

Server `https://mcp.higgsfield.ai/mcp`, OAuth in the browser (the server's metadata names Claude Code among its
clients). The official pages (`higgsfield.ai/mcp`, `higgsfield.ai/pricing`) list the models but not the tools.
Third-party guides of 2026 report five tools: `generate_image`, `generate_video`, `create_character`,
`get_generation_status`, `list_characters`; `generate_image` takes a `params` object with `prompt`, `model`,
`aspect_ratio`, reference pictures (`medias`) and an optional `get_cost: true` preflight that returns the credits
without generating. Models named on the official page: GPT Image 2, Nano Banana Pro, Seedream 5.0 Lite, Soul 2.0,
FLUX; the official CLI's `MODELS.md` lists for GPT Image the ratios `1:1 3:2 2:3 4:3 3:4 16:9 9:16 4:5 5:4 21:9`
and `1k 2k 4k`, an `Image Background Remover` that takes exactly one reference, and an `Outpaint`. None of that is
a promise about the MCP: list its tools, read `generate_image`'s schema, call `get_cost` if it exists, and only
then quote. Nano Banana Pro costs 2 credits a picture on the official pricing page. The result is reported as
returned at once (a URL or inline data): `save.mjs --url` or `--b64`.

## Prices read on 2026-10-09

| Provider | Payment | What a picture costs | Source |
|---|---|---|---|
| fal | prepaid credits, pay as you go, no subscription | Nano Banana Pro $0.15, Nano Banana 2 $0.08, FLUX 3 $0.024 per megapixel; cut and expand: `get_pricing` | fal.ai/pricing, fal.ai/docs/documentation/model-apis/pricing |
| Replicate | pay as you go, no subscription: prepaid credit, or a card charged at the start of each month for the previous one | flux-1.1-pro $0.04, flux-dev $0.025, flux-schnell $3 per 1,000, ideogram-v3-quality $0.09, recraft-v3 $0.04; Nano Banana Pro: the model page | replicate.com/pricing, replicate.com/docs/topics/billing |
| Higgsfield | a monthly subscription with fixed credits that reset every month | Starter $19 a month, 270 credits; Plus $59 or $47 a month billed annually, 1,200 credits; Ultra $129 or $99 billed annually, 3,000 credits; Nano Banana Pro 2 credits a picture. Via MCP every picture costs credits: the plans' "unlimited" and "free generations" work only on higgsfield.ai | higgsfield.ai/pricing |

Prices change. `mcp.mjs --offer` carries the same numbers with the day they were read; when a project starts
after a long pause, read the provider's page again before quoting. The user's spend is the user's: the plan
quotes, the user says yes, `costs.json` keeps the ledger.

## The recipe that keeps an original untouched

The user has a finished poster and wants a stamp, a ribbon, a badge on it:
1. **edit** the poster with a prompt that asks for ONE new element and nothing else, two takes.
2. **cut** the new element out of the take you prefer (crop around it first with sharp when the cut takes the
   whole picture).
3. Lay the cutout on the ORIGINAL poster as an image layer with a shadow. The poster is `protect: true`.
4. If the format must grow (1:1 to 3:4), **expand** the original first; `save.mjs --original` puts the original
   pixels back on top.

## The recipe for a series in one style

A story told in pictures (a carousel, the inserts of a reel) needs the same character, the same room, the same
palette in every picture. Generated one by one from text, they drift. The recipe:
1. **make** ONE anchor picture with the full style in the prompt: the kind of drawing (flat vector, no outlines,
   long soft shadows), the palette by hex, the character with no facial detail, and where the empty area is.
2. Every other picture is an **edit from references** with the anchor as the reference and a prompt that starts
   "Same character, same room, same style and palette as the reference picture" and then says only what changes
   in this scene.
3. If a picture goes into a video with captions, say "the bottom third of the picture stays dark and empty" in
   every prompt, so the words have their zone.
4. Show the set as one contact sheet before anything is composed; a picture that drifts is remade from the anchor.

## Prompts

- Say what to keep: "Keep everything exactly as it is: the layout, every person, every logo and every word."
- Say the one thing to add, its material and its place: "Add one bold red ribbon with the words SOLD OUT in white
  condensed capitals, across the lower third, slightly tilted, with a soft shadow."
- Never ask the model for Hebrew words. Hebrew is a text layer.
- For a character, name the pose, the light and the lens; for a background, the mood, the colours and where the
  empty area for text should be ("the upper half is calm and dark, for text").
