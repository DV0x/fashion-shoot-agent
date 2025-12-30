# Presets

All pose and background presets for the Tim workflow.

---

## Pose Presets

### confident-standing (default)

```
standing with weight shifted to one leg, hand resting on hip, shoulders back with chin slightly lifted, direct confident gaze at camera, editorial attitude
```

### seated-editorial

```
sitting elegantly on floor or low surface, relaxed upright posture, legs arranged gracefully, contemplative gaze, one hand resting naturally
```

### leaning-casual

```
leaning against wall or surface, relaxed shoulders, weight shifted to one side, approachable energy, soft natural gaze
```

### editorial-drama

```
angular high-fashion pose, strong geometric body shapes, dramatic tension in posture, intense editorial presence, fashion-forward attitude
```

### relaxed-natural

```
soft candid posture, natural unstaged stance, weight balanced, effortless and authentic feel, gentle expression
```

### street-walk

```
mid-stride walking motion, confident urban walk, natural arm movement, city energy, looking ahead or glancing at camera
```

### urban-lean

```
leaning against urban surface like wall or railing, street style attitude, one foot against wall, relaxed but intentional pose
```

---

## Background Presets

### studio-grey (default)

```
seamless grey studio backdrop, clean and timeless, professional fashion studio environment
```

### studio-white

```
white cyclorama background, bright and commercial, high-key studio lighting environment
```

### studio-black

```
dark void background, dramatic and moody, low-key studio with subject isolation
```

### industrial

```
raw concrete walls with urban texture, exposed architectural elements, edgy industrial setting
```

### warm-daylight

```
soft natural window light environment, warm and organic atmosphere, gentle diffused daylight
```

### color-gel

```
bold solid colored backdrop with editorial gel lighting, vibrant and fashion-forward, saturated color environment
```

### outdoor-urban

```
city street environment, urban architectural context, real-world metropolitan setting with street elements
```

---

## Usage

In prompt templates, replace:
- `{POSE_PRESET_SNIPPET}` → selected pose snippet from above
- `{BACKGROUND_PRESET_SNIPPET}` → selected background snippet from above

### Example

If user wants "edgy dramatic vibes":
- Pose: `editorial-drama`
- Background: `studio-black`

Filled HERO_PROMPT would have:
```
Pose: angular high-fashion pose, strong geometric body shapes, dramatic tension in posture, intense editorial presence, fashion-forward attitude

Setting: dark void background, dramatic and moody, low-key studio with subject isolation
```
