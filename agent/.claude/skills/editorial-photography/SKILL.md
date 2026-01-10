---
name: editorial-photography
description: Provides prompt templates and presets for Tim workflow editorial fashion photography. Contains HERO_PROMPT, CONTACT_SHEET_PROMPT, and 6 VIDEO_PROMPTS with 7 pose and 7 background presets. Use FIRST before fashion-shoot-pipeline skill.
---

# Editorial Photography Skill

Provides **prompt templates** and **presets** for the Tim workflow fashion pipeline.

**After getting prompts from this skill** → Use `fashion-shoot-pipeline` skill for script execution.

## Quick Preset Selection

Match user's vibe to presets:

| User Says | Pose Preset | Background Preset |
|-----------|-------------|-------------------|
| edgy, dramatic, bold, intense | `editorial-drama` | `studio-black` |
| casual, relaxed, natural, chill | `relaxed-natural` | `studio-grey` |
| street, urban, city | `street-walk` | `outdoor-urban` |
| professional, clean, commercial | `confident-standing` | `studio-white` |
| industrial, raw, concrete | `leaning-casual` | `industrial` |
| warm, soft, intimate | `seated-editorial` | `warm-daylight` |
| colorful, vibrant, bold colors | `editorial-drama` | `color-gel` |
| *(no preference stated)* | `confident-standing` | `studio-grey` |

**Full preset snippets:** `.claude/skills/editorial-photography/presets/options.md`

## Available Prompts

| Prompt | Location | Use For |
|--------|----------|---------|
| HERO_PROMPT | `.claude/skills/editorial-photography/prompts/hero.md` | Full-body hero shot |
| CONTACT_SHEET_PROMPT | `.claude/skills/editorial-photography/prompts/contact-sheet.md` | 2×3 grid of 6 camera angles |
| VIDEO_PROMPTS (×6) | `.claude/skills/editorial-photography/prompts/video.md` | Camera movement per frame |

## The 6 Camera Angles (FIXED)

```
┌─────────────────┬─────────────────┬─────────────────┐
│  Frame 1        │  Frame 2        │  Frame 3        │
│  Beauty Portrait│  High-Angle 3/4 │  Low-Angle Full │
├─────────────────┼─────────────────┼─────────────────┤
│  Frame 4        │  Frame 5        │  Frame 6        │
│  Side-On Profile│  Intimate Close │  Extreme Detail │
└─────────────────┴─────────────────┴─────────────────┘
```

## Style Treatment (FIXED - Never Modify)

All images use this exact Fuji Velvia treatment:

```
The image is shot on fuji velvia film on a 55mm prime lens with a hard flash,
the light is concentrated on the subject and fades slightly toward the edges
of the frame. The image is over exposed showing significant film grain and is
oversaturated. The skin appears shiny (almost oily).

3:2 aspect ratio
```

**If subject has glasses**, append: `"and there are harsh white reflections on the glasses frames."`

## Handoff to Pipeline

After selecting presets and filling prompt templates:

1. You have: filled HERO_PROMPT, CONTACT_SHEET_PROMPT, VIDEO_PROMPTS
2. **Next:** Use Skill tool → `fashion-shoot-pipeline`
3. Pass filled prompts to script `--prompt` flags

**Flow:** Hero → Contact Sheet (checkpoint) → crop-frames (checkpoint) → Videos → Stitch

## Rules

- ✅ Read `.claude/skills/editorial-photography/presets/options.md` for exact preset snippets
- ✅ Fill `{POSE_PRESET_SNIPPET}` and `{BACKGROUND_PRESET_SNIPPET}` in templates
- ✅ Fill `{STYLE_DETAILS}` based on glasses presence
- ✅ Chain to `fashion-shoot-pipeline` skill after getting prompts
- ❌ Never modify style treatment
- ❌ Never change the 6 camera angles
- ❌ Never write custom prompts - use templates exactly
