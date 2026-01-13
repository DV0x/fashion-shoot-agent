# Session Summary: Orchestrator Prompt Optimization

**Date:** 2025-12-28
**Focus:** Simplify orchestrator prompt, remove image analysis, add checkpoint modification handling

---

## Problem Statement

The original orchestrator prompt was causing expensive and slow image analysis:
- **15 turns** for a single image upload
- **$0.27 cost** just for analyzing 3 images
- **154 seconds** duration
- Agent was describing/analyzing images instead of just passing them to FAL.ai

---

## Root Cause Analysis

The original prompt instructed the agent to:
```
### Step 2: Analyze Reference Images

Look at the user's reference images and extract:

SUBJECT:      [Age, gender, ethnicity, hair color/style, facial features]
WARDROBE:     [Main garment(s), fit, material, color]
ACCESSORIES:  [Glasses, jewelry, shoes, bags, hats - be specific]
...
```

This caused Claude to spend many turns analyzing and describing images, when FAL.ai's nano-banana-pro model can handle all visual intelligence automatically.

---

## Solution: Simplified Orchestrator

### Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| Image analysis | Claude analyzes images in detail | NO analysis - pass directly to FAL.ai |
| Prompt size | ~280 lines | ~160 lines |
| Script commands | Hardcoded inline | Reference skill for details |
| Preset selection | Manual extraction | Keyword matching from user prompt |
| Checkpoint handling | Basic | Full modification loop support |

### New Flow

```
User uploads images + "create a shoot with edgy vibes"
    ↓
Agent matches "edgy" → editorial-drama + studio-black presets
    ↓
Agent reads fashion-shoot-pipeline SKILL.md for script syntax
    ↓
Agent runs generate-image.ts with ALL images as --input
    ↓
FAL.ai nano-banana-pro handles face/clothing recognition
    ↓
CHECKPOINT 1 → User approves or requests changes
    ↓
... continues through pipeline
```

---

## Image Handling Flow (Discovered)

### 1. Upload
```
POST /upload → saves to /uploads/{timestamp}-{random}.{ext}
```

### 2. Server Embeds Paths in Prompt
```typescript
// sdk-server.ts lines 441-454
fullPrompt = `${prompt}

## Reference Image File Paths
- Reference 1: /path/to/uploads/image1.jpg
- Reference 2: /path/to/uploads/image2.jpg

CRITICAL: Pass ALL reference images using --input flags...`;
```

### 3. Session Stores Images
```typescript
// session-manager.ts
session.pipeline = {
  inputImages: ["/path/to/image1.jpg", "/path/to/image2.jpg"],
  assets: { frames: [], videos: [] }
};
```

### 4. Generated Assets (Deterministic Paths)
```
outputs/
├── hero.png              ← STEP 1
├── contact-sheet.png     ← STEP 2
├── frames/
│   ├── frame-1.png       ← STEP 3 (crop)
│   └── frame-{2-6}.png
├── videos/
│   └── video-{1-6}.mp4   ← STEP 4
└── final/
    └── fashion-video.mp4 ← STEP 5
```

---

## Checkpoint Modification Handling

### At Checkpoint 1 (Hero)

**User says:** "make it more dramatic"

**Agent action:**
1. Parse request → Select new presets (editorial-drama + studio-black)
2. Re-run generate-image.ts with ORIGINAL input images + NEW presets
3. Output CHECKPOINT 1 again
4. Loop until user says "continue"

### At Checkpoint 2 (Frames)

**User says:** "modify frame 3 to add sunglasses"

**Agent action:**
1. Parse which frame (frame-3.png)
2. Run generate-image.ts with:
   - `--input outputs/frames/frame-3.png`
   - `--prompt "Take this image and add sunglasses. Maintain fuji velvia style."`
   - `--output outputs/frames/frame-3.png` (overwrites)
3. Output CHECKPOINT 2 again
4. Loop until user says "continue"

---

## Preset Selection Logic

| User Keywords | Pose Preset | Background Preset |
|---------------|-------------|-------------------|
| edgy, dramatic, bold, intense | editorial-drama | studio-black |
| casual, relaxed, natural, chill | relaxed-natural | studio-grey |
| street, urban, city | street-walk | outdoor-urban |
| professional, clean, commercial | confident-standing | studio-white |
| industrial, raw, concrete | editorial-drama | industrial |
| *(nothing specific)* | confident-standing | studio-grey |

---

## Skills Architecture

### Skill 1: editorial-photography (Knowledge)
**Location:** `agent/.claude/skills/editorial-photography/`
- Provides preset definitions (poses, backgrounds)
- Contains prompt templates
- Defines fixed 6-frame camera angles
- Defines Fuji Velvia style treatment

### Skill 2: fashion-shoot-pipeline (Action)
**Location:** `agent/.claude/skills/fashion-shoot-pipeline/`
- `generate-image.ts` → FAL.ai nano-banana-pro
- `crop-frames.ts` → Sharp (LOCAL, no API)
- `generate-video.ts` → FAL.ai Kling 2.6 Pro
- `stitch-videos.ts` → FFmpeg (LOCAL, no API)

---

## Expected Performance Improvement

| Metric | Before | After (Expected) |
|--------|--------|------------------|
| Cost per image upload | $0.27 | ~$0.05-0.10 |
| Turns for hero generation | 15 | 3-5 |
| Duration | 154s | ~60-90s |
| Token usage | High (image analysis) | Low (just orchestration) |

---

## Files Modified

### 1. `server/lib/orchestrator-prompt.ts`
Complete rewrite:
- Removed image analysis instructions
- Added skill reference pattern
- Added preset selection logic
- Added checkpoint modification handling
- Reduced from ~280 lines to ~160 lines

---

## Testing Notes

After making changes, restart backend and test:

```bash
# Terminal 1 - Backend
cd /Users/chakra/Documents/Agents/fashion-shoot-agent
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Test scenarios:
1. Upload images + "generate a shoot" → Should use defaults
2. Upload images + "make it edgy" → Should use editorial-drama + studio-black
3. At checkpoint 1, say "change to outdoor" → Should regenerate with outdoor-urban
4. At checkpoint 2, say "modify frame 3" → Should edit specific frame

---

## Remaining Work

- [ ] Test the simplified flow end-to-end
- [ ] Verify checkpoint modification loops work correctly
- [ ] Monitor token usage and costs after changes
- [ ] Consider debouncing session saves (currently saves on every message)

---

## Key Learnings

1. **FAL.ai is smart** - No need for Claude to analyze images; nano-banana-pro handles face/clothing recognition automatically

2. **Reference skills, don't duplicate** - Keep script details in SKILL.md, orchestrator just references them

3. **Deterministic paths simplify logic** - Knowing frames are always at `outputs/frames/frame-{1-6}.png` makes modification handling straightforward

4. **Checkpoint loops** - Allow user to iterate until satisfied before moving to next stage

5. **Keyword matching** - Simple preset selection based on user's words is more efficient than detailed analysis
