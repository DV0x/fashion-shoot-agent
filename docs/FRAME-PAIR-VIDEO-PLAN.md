# Frame-Pair Video Generation with Kling Direct API

## Status: IMPLEMENTED ✅

**Commit:** `09362bd feat: Replace FAL.ai with Kling direct API for frame-pair video generation`

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| API Provider | FAL.ai wrapper | Kling direct API |
| Authentication | `FAL_KEY` | `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` (JWT) |
| Videos generated | 6 (single frame each) | 5 (frame pairs) |
| Video parameter | `--input` only | `--input` + `--input-tail` |
| Checkpoint trigger | `video-6.mp4` | `video-5.mp4` |
| Final video duration | ~24s | ~20s |

---

## Frame-Pair Mapping

```
Clip 1: frame-1.png → frame-2.png
Clip 2: frame-2.png → frame-3.png
Clip 3: frame-3.png → frame-4.png
Clip 4: frame-4.png → frame-5.png
Clip 5: frame-5.png → frame-6.png
```

Formula: `clip N uses frame-N (start) + frame-(N+1) (end)`

---

## Kling API Authentication

Uses **JWT (JSON Web Token)** with HS256 signing:

```typescript
// JWT Header
{ "alg": "HS256", "typ": "JWT" }

// JWT Payload
{
  "iss": KLING_ACCESS_KEY,    // Issuer
  "exp": now + 1800,          // Expires in 30 minutes
  "nbf": now - 5              // Not before (clock skew buffer)
}

// Signature
HMAC-SHA256(header.payload, KLING_SECRET_KEY)
```

**Environment Variables:**
```bash
KLING_ACCESS_KEY=your-access-key
KLING_SECRET_KEY=your-secret-key
```

---

## Files Modified

### 1. `agent/.claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts`

Complete rewrite:
- Removed FAL.ai dependency
- Added JWT token generation with `createHmac('sha256', secretKey)`
- Added `--input-tail` CLI parameter for end frame
- Implemented async polling (5s interval, 10 min timeout)
- Base64 encodes local files without `data:` prefix

**Usage:**
```bash
npx tsx generate-video.ts \
  --input frame-1.png \
  --input-tail frame-2.png \
  --prompt "Camera movement description" \
  --output video-1.mp4
```

### 2. `server/lib/ai-client.ts`

- Changed checkpoint trigger: `video-6.mp4` → `video-5.mp4`
- Updated regex: `video-[1-6]` → `video-[1-5]`
- Updated artifacts array to 5 videos
- Added frame pair labels to checkpoint message

### 3. `server/lib/orchestrator-prompt.ts`

- Updated Phase 5 for frame-pair execution
- Added frame-pair mapping for clip regeneration
- Updated stitch command to use 5 clips

### 4. `agent/.claude/skills/fashion-shoot-pipeline/SKILL.md`

- Updated pipeline: 6 videos → 5 videos
- Added `--input-tail` parameter documentation
- Added frame-pair mapping table
- Updated error messages for `KLING_ACCESS_KEY`/`KLING_SECRET_KEY`

### 5. `agent/.claude/skills/editorial-photography/prompts/video.md`

Rewrote 6 single-frame prompts as 5 transition prompts with camera language:

| Video | Transition | Camera Movement |
|-------|------------|-----------------|
| 1 | Beauty Portrait → High-Angle 3/4 | Jib Up + Arc |
| 2 | High-Angle 3/4 → Low-Angle Full Body | Descending Arc |
| 3 | Low-Angle Full Body → Side Profile | Low Dolly Arc |
| 4 | Side Profile → Close Portrait | Dolly In |
| 5 | Close Portrait → Extreme Detail | Macro Push |

**Note:** `camera_control` JSON parameter unavailable with `image_tail`. Camera movements described in text prompt instead.

### 6. `frontend/src/components/chat/VideoGrid.tsx`

- Added `FRAME_PAIR_LABELS` constant: `['1→2', '2→3', '3→4', '4→5', '5→6']`
- Shows "Clip N (X→Y)" for 5-video grids
- Updated both thumbnail badges and lightbox labels

### 7. `docs/ARCHITECTURE.md`

- Updated video gen: FAL.ai → Kling AI direct API
- Updated pipeline flow: 5 videos, ~20s final
- Added frame-pair explanation
- Added `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` to env vars

### 8. `workflows/fashion-editorial.json`

- Changed `repeat` from 6 to 5
- Added `inputTailPattern: "outputs/frames/frame-{n+1}.png"`
- Updated checkpoint detection to `video-5.mp4`
- Added `framePairMapping` for regeneration

### 9. `server/sdk-server.ts`

- Updated test endpoint artifacts to 5 videos
- Updated checkpoint message

### 10. `server/lib/session-manager.ts`

- Updated comment: `video-1.mp4 through video-5.mp4 (frame pairs)`

### 11. `agent/.claude/skills/fashion-shoot-pipeline/scripts/stitch-videos-eased.ts`

- Updated help text example to use 5 videos

### 12. `.env`

Added:
```bash
KLING_ACCESS_KEY=...
KLING_SECRET_KEY=...
```

---

## API Details

**Endpoint:** `https://api-singapore.klingai.com/v1/videos/image2video`

**Request Body:**
```json
{
  "model_name": "kling-v2-6",
  "mode": "pro",
  "duration": "5",
  "image": "<base64-start-frame>",
  "image_tail": "<base64-end-frame>",
  "prompt": "Camera movement description",
  "negative_prompt": "blur, distort, and low quality"
}
```

**Constraint:** `image_tail` cannot be used with `camera_control` or `dynamic_masks/static_mask`.

**Async Workflow:**
1. POST → returns `task_id`
2. GET `/v1/videos/image2video/{task_id}` to poll
3. When `task_status === "succeed"`, download from `task_result.videos[0].url`

---

## Test Commands

**Generate single frame-pair video:**
```bash
cd /Users/chakra/Documents/Agents/fashion-shoot-agent/agent && npx tsx .claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts --input outputs/frames/frame-1.png --input-tail outputs/frames/frame-2.png --prompt "Camera slowly rises on a jib arm. Smooth cinematic movement." --output outputs/videos/test-pair.mp4
```

**Stitch 5 videos:**
```bash
cd /Users/chakra/Documents/Agents/fashion-shoot-agent/agent && npx tsx .claude/skills/fashion-shoot-pipeline/scripts/stitch-videos-eased.ts --clips outputs/videos/video-1.mp4 --clips outputs/videos/video-2.mp4 --clips outputs/videos/video-3.mp4 --clips outputs/videos/video-4.mp4 --clips outputs/videos/video-5.mp4 --output outputs/final/fashion-video.mp4 -d 1.5 -e dramaticSwoop
```

---

## Verification Completed

- [x] JWT authentication works with Access Key + Secret Key
- [x] Frame-pair mode with `image_tail` generates interpolated videos
- [x] 5 videos generated from 6 frames
- [x] Stitch produces final video with 5 clips
- [x] Checkpoint triggers on `video-5.mp4`
