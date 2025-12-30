# VIDEO_PROMPTS

Camera movement prompts for each of the 6 frames. Each frame type has a specific movement style.

## Frame-to-Prompt Mapping

| Frame | Type | Camera Movement | Prompt |
|-------|------|-----------------|--------|
| 1 | Beauty Portrait | Push In | See below |
| 2 | High-Angle 3/4 | Orbital | See below |
| 3 | Low-Angle Full | Rise Up | See below |
| 4 | Side-On Profile | Lateral Track | See below |
| 5 | Intimate Close | Breath Movement | See below |
| 6 | Extreme Detail | Macro Drift | See below |

---

## VIDEO_PROMPT_1: Beauty Portrait → Push In

```
Camera pushes in toward the subject's face, maintaining eye contact. Micro-movements in expression. The lighting remains consistent throughout.
```

---

## VIDEO_PROMPT_2: High-Angle 3/4 → Orbital

```
Camera performs an orbital movement around the subject from the high angle, revealing different aspects of the wardrobe from above. Movement is smooth and elegant.
```

---

## VIDEO_PROMPT_3: Low-Angle Full → Rise Up

```
Camera rises from the low angle, emphasizing the subject's height and presence. The silhouette remains powerful throughout the movement.
```

---

## VIDEO_PROMPT_4: Side-On Profile → Lateral Track

```
Camera performs a lateral tracking movement along the subject's profile, maintaining the compressed telephoto look. Movement is smooth and refined.
```

---

## VIDEO_PROMPT_5: Intimate Close → Breath Movement

```
Extremely subtle movement suggesting the subject's natural breathing. Camera holds nearly still with micro-adjustments. Intimate and personal feeling.
```

---

## VIDEO_PROMPT_6: Extreme Detail → Macro Drift

```
Camera performs a steady drift across the detail, revealing texture and craftsmanship. Movement is precise and refined.
```

---

## Execution

For each frame, use `fashion-shoot-pipeline` skill:

```bash
# Frame 1
npx tsx scripts/generate-video.ts \
  --input outputs/frames/frame-1.png \
  --prompt "Camera pushes in toward the subject's face, maintaining eye contact. Micro-movements in expression. The lighting remains consistent throughout." \
  --output outputs/videos/video-1.mp4 \
  --duration 5

# Frame 2
npx tsx scripts/generate-video.ts \
  --input outputs/frames/frame-2.png \
  --prompt "Camera performs an orbital movement around the subject from the high angle, revealing different aspects of the wardrobe from above. Movement is smooth and elegant." \
  --output outputs/videos/video-2.mp4 \
  --duration 5

# Continue for frames 3-6...
```

## Stitch Command

After all 6 videos are generated:

```bash
npx tsx scripts/stitch-videos.ts \
  --clips outputs/videos/video-1.mp4 \
  --clips outputs/videos/video-2.mp4 \
  --clips outputs/videos/video-3.mp4 \
  --clips outputs/videos/video-4.mp4 \
  --clips outputs/videos/video-5.mp4 \
  --clips outputs/videos/video-6.mp4 \
  --output outputs/final/fashion-video.mp4 \
  --transition fade \
  --easing smooth \
  --transition-duration 1.2
```
