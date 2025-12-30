# HERO_PROMPT Template

Generates the initial full-body hero shot.

## Template

Replace placeholders with selections from `../presets/options.md`:

```
Show me a high fashion photoshoot image of the subject from the reference photo wearing the outfit and accessories from the reference images.

The image should show a full body shot of the subject.

Pose: {POSE_PRESET_SNIPPET}

Setting: {BACKGROUND_PRESET_SNIPPET}

The image is shot on fuji velvia film on a 55mm prime lens with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. {STYLE_DETAILS}

3:2 aspect ratio
```

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{POSE_PRESET_SNIPPET}` | `presets/options.md` → Pose section | `standing with weight shifted to one leg...` |
| `{BACKGROUND_PRESET_SNIPPET}` | `presets/options.md` → Background section | `seamless grey studio backdrop...` |
| `{STYLE_DETAILS}` | See below | Depends on glasses |

## Style Details

**If subject has glasses:**
```
{STYLE_DETAILS} = "The skin appears shiny (almost oily), and there are harsh white reflections on the glasses frames."
```

**If no glasses:**
```
{STYLE_DETAILS} = "The skin appears shiny (almost oily)."
```

## Example: Editorial Drama + Studio Black

```
Show me a high fashion photoshoot image of the subject from the reference photo wearing the outfit and accessories from the reference images.

The image should show a full body shot of the subject.

Pose: angular high-fashion pose, strong geometric body shapes, dramatic tension in posture, intense editorial presence, fashion-forward attitude

Setting: dark void background, dramatic and moody, low-key studio with subject isolation

The image is shot on fuji velvia film on a 55mm prime lens with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. The skin appears shiny (almost oily).

3:2 aspect ratio
```

## Execution

After filling template, use `fashion-shoot-pipeline` skill:

```bash
npx tsx scripts/generate-image.ts \
  --prompt "<FILLED_HERO_PROMPT>" \
  --input ref1.jpg --input ref2.jpg \
  --output outputs/hero.png \
  --aspect-ratio 3:2 \
  --resolution 2K
```
