# Plan: Frame-Pair Video Generation with Kling Direct API

## Summary

1. **Replace FAL.ai wrapper** with direct Kling AI API calls
2. **Add `image_tail` parameter** for start+end frame interpolation
3. **Change from 6 videos to 5 videos** (frame pairs)

**Current:** FAL.ai wrapper → 6 single-frame videos
**New:** Kling direct API → 5 frame-pair videos (frame-1+2, 2+3, 3+4, 4+5, 5+6)

---

## Kling API Key Points

From `docs/kling-video.md`:

**Endpoint:** `https://api-singapore.klingai.com/v1/videos/image2video`

**Key Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `model_name` | string | `kling-v2-6` (latest) |
| `image` | string | Start frame (Base64 or URL) |
| `image_tail` | string | End frame (Base64 or URL) - **NEW** |
| `prompt` | string | Movement description |
| `duration` | string | `"5"` or `"10"` |
| `mode` | string | `"pro"` for quality |

**Important Constraint (line 74):**
> `image+image_tail`, `dynamic_masks/static_mask`, and `camera_control` cannot be used simultaneously

This means:
- ❌ Cannot use `camera_control` JSON parameter with `image_tail`
- ✅ CAN describe camera movements in the text `prompt` field

Camera language in prompts still works! Use terms like "camera slowly rises", "dolly in", "jib arm descends", etc.

**Async Workflow:**
1. POST to create task → returns `task_id`
2. GET `/v1/videos/image2video/{task_id}` to poll status
3. When `task_status === "succeed"`, download from `task_result.videos[0].url`

---

## Files to Modify

### 1. `agent/.claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts`

**Complete rewrite - Replace FAL.ai with Kling direct API:**

**Current (FAL.ai wrapper):**
```typescript
import { fal } from "@fal-ai/client";
// Uses fal.subscribe() with fal-ai/kling-video model
const input = { image_url: imageUrl, prompt, duration };
```

**New (Kling direct API):**
```typescript
// No FAL.ai dependency
// Environment: KLING_API_KEY (not FAL_KEY)

// New CLI options
'input-tail': { type: 'string', short: 't' },  // End frame

// API call
const response = await fetch('https://api-singapore.klingai.com/v1/videos/image2video', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.KLING_API_KEY}`
  },
  body: JSON.stringify({
    model_name: 'kling-v2-6',
    mode: 'pro',
    duration: '5',
    image: startFrameBase64,      // or URL
    image_tail: endFrameBase64,   // NEW - or URL
    prompt: prompt,
    negative_prompt: negativePrompt
  })
});

// Async polling
const { data: { task_id } } = await response.json();
// Poll GET /v1/videos/image2video/{task_id} until succeed
// Download video from task_result.videos[0].url
```

**Key changes:**
- Remove `@fal-ai/client` dependency
- Add `KLING_API_KEY` env var (instead of `FAL_KEY`)
- Add `--input-tail` CLI parameter
- Implement async polling logic
- Use Base64 encoding for local files (no data: prefix)

### 2. `workflows/fashion-editorial.json`

**Changes:**
- Update `repeat` from 6 to 5
- Add `inputTailPattern` for end frames
- Update checkpoint detection to `video-5.mp4`
- Update artifacts list to 5 videos

```json
{
  "name": "clips",
  "repeat": 5,
  "inputPattern": "outputs/frames/frame-{n}.png",
  "inputTailPattern": "outputs/frames/frame-{n+1}.png",
  "outputPattern": "outputs/videos/video-{n}.mp4",
  "checkpoint": {
    "detect": [{ "output_contains": "video-5.mp4" }],
    "artifacts": ["video-1.mp4", "video-2.mp4", "video-3.mp4", "video-4.mp4", "video-5.mp4"]
  }
}
```

### 3. `server/lib/ai-client.ts`

**Checkpoint detection updates:**
- Change trigger from `video-6.mp4` to `video-5.mp4`
- Update artifacts array from 6 to 5 videos
- Update regex from `video-[1-6]` to `video-[1-5]`

**Update checkpoint message to show frame pairs:**
```typescript
message: `5 video clips generated:
- Clip 1: frames 1→2
- Clip 2: frames 2→3
- Clip 3: frames 3→4
- Clip 4: frames 4→5
- Clip 5: frames 5→6

Review and choose: regenerate clip N, adjust speed, or continue to stitch.`
```

### 4. `server/lib/orchestrator-prompt.ts`

**Update instructions:**
```
Execute generate-video.ts for frame pairs (5 times, sequentially):
- video-1: frame-1 (--input) + frame-2 (--input-tail)
- video-2: frame-2 (--input) + frame-3 (--input-tail)
- video-3: frame-3 (--input) + frame-4 (--input-tail)
- video-4: frame-4 (--input) + frame-5 (--input-tail)
- video-5: frame-5 (--input) + frame-6 (--input-tail)
```

**Clip Regeneration Mapping:**
When user says "regenerate clip N", the agent knows which frame pair to use:

| User Request | Frame Pair | Command |
|--------------|------------|---------|
| "regenerate clip 1" | frame-1 + frame-2 | `--input frame-1.png --input-tail frame-2.png` |
| "regenerate clip 2" | frame-2 + frame-3 | `--input frame-2.png --input-tail frame-3.png` |
| "regenerate clip 3" | frame-3 + frame-4 | `--input frame-3.png --input-tail frame-4.png` |
| "regenerate clip 4" | frame-4 + frame-5 | `--input frame-4.png --input-tail frame-5.png` |
| "regenerate clip 5" | frame-5 + frame-6 | `--input frame-5.png --input-tail frame-6.png` |

Formula: `clip N uses frame-N and frame-(N+1)`

### 5. `agent/.claude/skills/fashion-shoot-pipeline/SKILL.md`

**Documentation updates:**
- Change "6 videos" to "5 videos"
- Add `--input-tail` parameter docs
- Update example commands
- Note: camera_control not available with image_tail

### 6. `agent/.claude/skills/editorial-photography/prompts/video.md`

**Transition prompts with camera movements in text:**

Note: We can't use `camera_control` JSON parameter with `image_tail`, but we CAN describe camera movements in the text prompt.

Per Kling best practices: `Subject + Movement + Camera Language`

```markdown
# TRANSITION_PROMPTS (5 videos from 6 frames)

## Video 1: Beauty Portrait → High-Angle 3/4
The camera slowly rises on a jib arm while the fashion model's gaze lifts upward.
The camera movement is smooth and deliberate. Cinematic quality.

## Video 2: High-Angle 3/4 → Low-Angle Full Body
The camera descends dramatically from overhead to ground level.
The model's posture elongates as the perspective shifts. Slow, sweeping motion.

## Video 3: Low-Angle Full Body → Side Profile
The camera arcs at low level around the subject, revealing a profile silhouette.
The model turns gracefully. Dolly movement, cinematic quality.

## Video 4: Side Profile → Close Portrait
The camera slowly dollies in toward the subject's face.
Smooth push-in, the model's expression softens. Shallow depth of field.

## Video 5: Close Portrait → Extreme Detail
The camera slowly and smoothly pushes in on fabric texture and details.
Macro-like creep movement. The subject is completely still.
```

**Key camera terms to use in prompts:**
- "camera slowly rises/descends"
- "camera arcs/orbits around"
- "camera dollies in/out"
- "jib arm", "boom", "dolly"
- "slow push-in", "creep movement"
- "cinematic quality", "smooth motion"

### 7. `frontend/src/components/chat/VideoGrid.tsx` (optional enhancement)

**Add frame pair labels to video thumbnails:**
```tsx
// Show which frames each clip uses
const framePairLabels = ['1→2', '2→3', '3→4', '4→5', '5→6'];

// Display label on each video thumbnail
<span className="text-xs text-white/70">Clip {i+1} ({framePairLabels[i]})</span>
```

This helps users understand which frames to modify if they want to regenerate a clip.

### 8. `docs/ARCHITECTURE.md`

- Update pipeline: 6 clips → 5 clips
- Update final video duration: ~24s → ~20s
- Note: Using Kling direct API (not FAL.ai)

### 9. `.env` (or environment)

- Add `KLING_API_KEY` environment variable
- `FAL_KEY` no longer needed for video generation

---

## generate-video.ts Implementation Details

### Async Polling Logic

```typescript
async function pollForCompletion(taskId: string): Promise<string> {
  const pollInterval = 5000; // 5 seconds
  const maxAttempts = 120;   // 10 minutes max

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://api-singapore.klingai.com/v1/videos/image2video/${taskId}`,
      {
        headers: { 'Authorization': `Bearer ${process.env.KLING_API_KEY}` }
      }
    );
    const { data } = await response.json();

    if (data.task_status === 'succeed') {
      return data.task_result.videos[0].url;
    }
    if (data.task_status === 'failed') {
      throw new Error(`Video generation failed: ${data.task_status_msg}`);
    }

    console.error(`[Kling] Status: ${data.task_status}...`);
    await new Promise(r => setTimeout(r, pollInterval));
  }
  throw new Error('Video generation timed out');
}
```

### Base64 Encoding (for local files)

```typescript
async function encodeImageBase64(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  // No "data:image/png;base64," prefix - raw Base64 only
  return buffer.toString('base64');
}
```

---

## Verification Steps

1. **Set up Kling API key:**
   ```bash
   export KLING_API_KEY="your-key-here"
   ```

2. **Test single frame-pair generation:**
   ```bash
   cd agent/.claude/skills/fashion-shoot-pipeline/scripts
   npx tsx generate-video.ts \
     --input ../../../outputs/frames/frame-1.png \
     --input-tail ../../../outputs/frames/frame-2.png \
     --prompt "The fashion model transitions gracefully" \
     --output ../../../outputs/videos/test-pair.mp4
   ```

3. **Verify API call** - Check Kling dashboard for `image_tail` in request

4. **Run full pipeline** - Verify:
   - 5 videos generated (not 6)
   - Checkpoint triggers on video-5.mp4
   - Stitch produces final video with 5 clips

5. **Frontend verification:**
   - VideoGrid shows 5 clips at Checkpoint 4
   - Each clip thumbnail shows frame pair label (e.g., "1→2")
   - Clip regeneration works ("regenerate clip 3" → uses frames 3+4)

---

## Impact Summary

| Aspect | Before | After |
|--------|--------|-------|
| API Provider | FAL.ai wrapper | Kling direct API |
| Videos generated | 6 | 5 |
| API calls | 6 | 5 (20% cost reduction) |
| Raw video duration | 6 × 5s = 30s | 5 × 5s = 25s |
| Final video (after stitch) | ~24s | ~20s (depends on --clip-duration) |
| Transition method | Camera movements (single frame) | Frame interpolation (start+end) + camera movements in text |
| Camera control param | Available | Not available with image_tail (use text prompts instead) |
| Checkpoint trigger | `video-6.mp4` | `video-5.mp4` |
| Env variable | `FAL_KEY` | `KLING_API_KEY` |
