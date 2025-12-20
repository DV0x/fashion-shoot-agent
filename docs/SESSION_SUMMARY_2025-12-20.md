# Session Summary - December 20, 2025

## Overview

End-to-end testing of the Fashion Shoot Agent pipeline with bug fixes and improvements.

---

## What We Accomplished

### 1. Explored Codebase Architecture
- Reviewed the full project structure
- Understood the 6-stage pipeline: Analyze → Hero → Contact Sheet → Isolate Frames → Videos → Stitch

### 2. Fixed Critical Bugs

#### Bug 1: Session Directory Creation Error
**Error:** `Session session_xxx not found`
**Cause:** `getOrCreateSession()` was creating a new session with random ID instead of using provided ID
**Fix:** Added `createSessionWithId()` method in `session-manager.ts` (line 136-160)

#### Bug 2: Reference Image Not Passed to Agent
**Error:** Agent asked for reference image instead of using provided one
**Cause:** Image paths weren't included in the text prompt
**Fix:** Updated `sdk-server.ts` to include file paths in prompt (line 322-337)

#### Bug 3: Images Not Sent as Base64
**Error:** Agent couldn't "see" the images, only had file paths
**Cause:** SDK requires base64-encoded images in content array
**Fix:** Updated `ai-client.ts`:
- Added `loadImageAsBase64()` helper function (line 28-59)
- Updated `createPromptGenerator()` to build multimodal content (line 101-138)
- Updated `queryWithSession()` to accept `imagePaths` parameter (line 144)

#### Bug 4: maxTurns Limit Too Low
**Error:** `error_max_turns` - pipeline stopped at frame isolation
**Cause:** `maxTurns: 20` insufficient for full pipeline (~36 turns needed)
**Fix:** Increased to `maxTurns: 100` in `ai-client.ts` (line 79)

#### Bug 5: Hero Image Used Text-to-Image Instead of Image-to-Image
**Error:** Subject's face changed in hero image
**Cause:** Agent didn't pass `--input` flag with reference image
**Fix:**
- Updated `sdk-server.ts` to show example with `--input` flag
- Updated `orchestrator-prompt.ts` with CRITICAL instruction (line 74-87)

#### Bug 6: Only 1 Reference Image Passed (Not All 3)
**Error:** Watch didn't match reference (garmin.jpg not passed)
**Cause:** Example only showed single `--input` flag
**Fix:** Updated `sdk-server.ts` to generate ALL `--input` flags (line 325-336):
```typescript
const inputFlags = images.map((img: string) => `--input "${img}"`).join(' ');
```

---

## Successful End-to-End Test Results

**Test Run:** Session `session_1766160931635`

| Metric | Value |
|--------|-------|
| Duration | 15.8 minutes |
| Cost | $0.79 |
| Turns | 36 |
| Status | ✅ Complete |

**Generated Assets:**
- `outputs/hero.png` - Hero image (2K)
- `outputs/contact-sheet.png` - 6-angle grid (2K)
- `outputs/frames/frame-1.png` through `frame-6.png` - Isolated frames
- `outputs/videos/video-1.mp4` through `video-6.mp4` - 5s videos each
- `outputs/final/fashion-video.mp4` - Stitched final video

**Output Location:**
```
/Users/chakra/Documents/Agents/fashion-shoot-agent/agent/.claude/skills/fashion-shoot-pipeline/outputs/
```

---

## Remaining Issues (To Fix in Next Session)

### Issue 1: Frame Isolation Unreliable (PRIORITY)
**Problem:** AI-based frame isolation doesn't work reliably. Frame 3 contained entire contact sheet instead of isolated frame.
**Cause:** FAL.ai doesn't understand grid coordinate prompts like "row 1 column 3"
**Solution:** Create `crop-frames.ts` script for programmatic cropping

**Implementation Plan:**
```
Contact Sheet (2K, 3:2 ratio) → 2048 × 1365 pixels
├── 3 columns × 2 rows = 6 frames
├── Each frame: ~682 × 682 pixels
└── Crop mathematically using sharp/jimp
```

**Script to create:** `agent/.claude/skills/fashion-shoot-pipeline/scripts/crop-frames.ts`
```bash
npx tsx crop-frames.ts \
  --input outputs/contact-sheet.png \
  --output-dir outputs/frames/ \
  --rows 2 \
  --cols 3
```

### Issue 2: Videos in Slow Motion
**Problem:** All videos play in slow motion
**Cause:** Prompt words like "slowly", "gently", "slow descent"
**Solutions:**
1. Update video prompts in `tim-workflow-templates.md` to remove slow motion words
2. Add `--speed` flag to `stitch-videos.ts` for post-processing speed adjustment

### Issue 3: Watch Reference Not Applied (May Be Fixed)
**Problem:** Garmin watch in output didn't match reference image
**Cause:** Only 1 reference image was passed to FAL.ai
**Fix Applied:** Updated prompt to include ALL `--input` flags
**Status:** Needs testing to verify fix works

---

## Files Modified

| File | Changes |
|------|---------|
| `server/lib/session-manager.ts` | Added `createSessionWithId()` method |
| `server/lib/ai-client.ts` | Added base64 image support, multimodal content, increased maxTurns |
| `server/sdk-server.ts` | Added image paths to prompt, ALL `--input` flags |
| `server/lib/orchestrator-prompt.ts` | Added CRITICAL instruction for `--input` flag |
| `docs/IMPLEMENTATION_PLAN.md` | Updated progress tracker |

---

## Key Learnings

### SDK Image Input
- Images must be base64 encoded in content array
- Requires streaming input mode (async generator)
- File paths must also be in TEXT for agent to use with scripts

### FAL.ai nano-banana-pro
- Supports multiple reference images via `image_urls` array
- Text description works for generic items (jacket)
- Text description fails for specific products (exact watch model)
- Grid coordinate prompts don't work for isolation

### Pipeline Considerations
- Full pipeline needs ~36 turns (set maxTurns: 100)
- Full pipeline takes ~16 minutes
- Cost: ~$0.79 per run

---

## Next Session TODO

1. [ ] Create `crop-frames.ts` script (programmatic frame cropping)
2. [ ] Test with all 3 reference images (verify watch fix)
3. [ ] Fix slow motion videos (update prompts or add speed control)
4. [ ] Update `IMPLEMENTATION_PLAN.md` with Phase 6 completion
5. [ ] Consider output directory consolidation (currently in skills folder)

---

## Commands Reference

### Start Server
```bash
cd /Users/chakra/Documents/Agents/fashion-shoot-agent
npm run dev
```

### Run Test
```bash
curl -X POST http://localhost:3002/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create an editorial fashion photoshoot with these references. Streetwear aesthetic, confident energy. Frame 6 should focus on the Garmin watch.",
    "inputImages": [
      "/Users/chakra/Documents/Agents/fashion-shoot-agent/test-images/rahul.jpg",
      "/Users/chakra/Documents/Agents/fashion-shoot-agent/test-images/garmin.jpg",
      "/Users/chakra/Documents/Agents/fashion-shoot-agent/test-images/jacket.jpg"
    ]
  }'
```

### View Outputs
```bash
open /Users/chakra/Documents/Agents/fashion-shoot-agent/agent/.claude/skills/fashion-shoot-pipeline/outputs/
```

---

## Contact Sheet Frame Layout

```
┌─────────────────┬─────────────────┬─────────────────┐
│  Frame 1 (0,0)  │  Frame 2 (0,1)  │  Frame 3 (0,2)  │
│  Beauty Portrait│  High-Angle 3/4 │  Low-Angle Full │
├─────────────────┼─────────────────┼─────────────────┤
│  Frame 4 (1,0)  │  Frame 5 (1,1)  │  Frame 6 (1,2)  │
│  Side-On Profile│  Intimate Close │  Extreme Detail │
└─────────────────┴─────────────────┴─────────────────┘
```

Crop coordinates (for 2048×1365 contact sheet):
- Frame 1: x=0, y=0, w=682, h=682
- Frame 2: x=682, y=0, w=682, h=682
- Frame 3: x=1364, y=0, w=682, h=682
- Frame 4: x=0, y=682, w=682, h=682
- Frame 5: x=682, y=682, w=682, h=682
- Frame 6: x=1364, y=682, w=682, h=682
