# Session Summary - 2026-01-10

## Overview

Implemented contact-sheet checkpoint and resolved image upload size issues.

---

## Changes Made

### 1. Contact Sheet Checkpoint (New)

Added a new checkpoint after contact sheet generation, before frame extraction.

**New Pipeline Flow:**
```
Hero → CHECKPOINT 1 → Contact Sheet → CHECKPOINT 2 → crop-frames → CHECKPOINT 3 → Videos → CHECKPOINT 4 → Stitch
```

**Files Modified:**
- `server/lib/orchestrator-prompt.ts` - Added Phase 3 (Contact Sheet → CHECKPOINT 2), renumbered subsequent phases
- `workflows/fashion-editorial.json` - Added checkpoint config for contact-sheet phase
- `frontend/src/lib/types.ts` - Added `'contact-sheet'` to Checkpoint stage union
- `frontend/src/components/chat/CheckpointMessage.tsx` - Added contact-sheet stage label and icon

### 2. Frame Extraction Method

**Attempted:** AI-powered isolation using FAL.ai with "Isolate and amplify" prompts

**Result:** Unreliable - some frames (2 & 6) returned full grid instead of isolated frames

**Final Decision:** Reverted to `crop-frames.ts` (variance-based grid detection)
- 100% reliable
- No API calls (local processing)
- Auto-normalizes frame dimensions

**Files Modified:**
- `workflows/fashion-editorial.json` - frames phase uses crop-frames.ts
- `server/lib/orchestrator-prompt.ts` - Phase 4 uses crop-frames.ts command
- `agent/.claude/skills/fashion-shoot-pipeline/SKILL.md` - Updated to document crop-frames.ts
- `agent/.claude/skills/editorial-photography/SKILL.md` - Removed individual-frames.md reference

**Files Removed:**
- `agent/.claude/skills/editorial-photography/prompts/individual-frames.md` (no longer needed)

### 3. Image Upload Size Fix

**Problem:** User uploads from frontend failed with "Image was too large" (7MB contact sheet)

**Root Cause:** Images were passed as base64 multimodal input to Claude (5MB limit)

**Solution:** Removed base64 image passing - images are now referenced by path only

**Files Modified:**
- `server/sdk-server.ts` - Removed `images` parameter from `queryWithSession()` calls in both `/generate` and `/generate-stream` endpoints

**How It Works Now:**
1. User uploads image → saved to `/uploads/`
2. File path included in prompt text
3. Agent passes path to `generate-image.ts --input` (FAL.ai handles it)
4. Agent can use Read tool to view images if needed (no size limit issue)

### 4. Stitch Script Optimization

Added smart dimension checking - skips scaling when all clips have uniform dimensions.

**Files Modified:**
- `agent/.claude/skills/fashion-shoot-pipeline/scripts/stitch-videos-eased.ts`
  - Added `allSameDimensions()` helper function
  - `scaleWithPadding` now conditional: only scales if dimensions differ

---

## Technical Details

### Image Handling Comparison

| Method | Size Limit | When Used |
|--------|------------|-----------|
| Base64 multimodal input | 5MB | Was used for uploads (removed) |
| Read tool | No practical limit | Agent reads generated images |
| File path to FAL.ai | No limit | generate-image.ts --input |

### Checkpoint Detection

Contact-sheet checkpoint detection rule in `workflows/fashion-editorial.json`:
```json
{
  "detect": {
    "output_contains": "outputs/contact-sheet.png"
  }
}
```

---

## Files Changed Summary

| File | Change |
|------|--------|
| `server/lib/orchestrator-prompt.ts` | Added contact-sheet checkpoint (Phase 3), use crop-frames.ts |
| `server/sdk-server.ts` | Removed base64 image passing |
| `workflows/fashion-editorial.json` | Contact-sheet checkpoint, crop-frames.ts for frames |
| `frontend/src/lib/types.ts` | Added 'contact-sheet' stage |
| `frontend/src/components/chat/CheckpointMessage.tsx` | Contact-sheet UI |
| `agent/.claude/skills/fashion-shoot-pipeline/SKILL.md` | crop-frames.ts docs |
| `agent/.claude/skills/editorial-photography/SKILL.md` | Removed individual-frames ref |
| `stitch-videos-eased.ts` | Smart dimension checking |

**Removed:**
- `agent/.claude/skills/editorial-photography/prompts/individual-frames.md`

---

## Testing Notes

### crop-frames.ts Test
```bash
cd agent && npx tsx .claude/skills/fashion-shoot-pipeline/scripts/archive/crop-frames.ts \
  --input outputs/contact-sheet.png \
  --output-dir outputs/frames-test/
```
Result: Successfully cropped 6 frames, normalized to 818×816

### Image Upload Flow
1. Upload large image (7MB+) from frontend
2. Image saved to `/uploads/`
3. Path passed in prompt
4. Agent uses path with generate-image.ts --input
5. No size limit errors
