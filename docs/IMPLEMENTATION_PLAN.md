# Fashion Shoot Agent - Implementation Plan

## Overview

Build an AI-powered fashion photoshoot generation agent using the Claude Agent SDK. The agent takes reference images and a simple prompt, then orchestrates a multi-stage pipeline to generate editorial photography and video content.

**Workflow Base:** Tim Contact Sheet (29 nodes, single model focus)

---

## Progress Tracker

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| Phase 1 | Project Setup & Skill Structure | ✅ Complete | `7bd2add` |
| Phase 2 | Knowledge Skill (editorial-photography) | ✅ Refactored | - |
| Phase 3 | Action Skill (fashion-shoot-pipeline) | ✅ Complete | - |
| Phase 4 | Orchestrator System Prompt Update | ✅ Complete | - |
| Phase 5 | Session Management Integration | ✅ Complete | - |
| Phase 6 | Testing & Validation | ⏳ Pending | - |

### Phase 3 Progress
| Script | Status | Tested |
|--------|--------|--------|
| `generate-image.ts` | ✅ Complete | ✅ Yes |
| `generate-video.ts` | ✅ Complete | ✅ Yes |
| `stitch-videos.ts` | ✅ Complete | ✅ Yes |

**Last Updated:** 2025-12-19

---

## Architecture Summary

### Input
- Reference images (3+): model, outfit, accessories
- One-line prompt: "Streetwear editorial, confident energy"

### Output
- Hero image, contact sheet, 6 isolated frames
- 6 video clips, final stitched video

### Tech Stack
- **Runtime:** Node.js + TypeScript
- **Agent SDK:** @anthropic-ai/claude-agent-sdk
- **Image Generation:** FAL.ai (nano-banana-pro)
- **Video Generation:** FAL.ai (Kling 2.6 Pro)
- **Video Stitching:** FFmpeg 8.x + fluent-ffmpeg
- **Easing:** Custom xfade expressions (based on xfade-easing project)
- **Architecture:** Agent Skills (no MCP)

---

## Implementation Phases

### Phase 1: Project Setup & Skill Structure ✅

**Status:** Complete (commit `7bd2add`)

**Step 1.1: Create skill directories** ✅
```
agent/.claude/skills/
├── editorial-photography/
│   ├── SKILL.md
│   └── workflows/
└── fashion-shoot-pipeline/
    ├── SKILL.md
    └── scripts/
```

**Step 1.2: Install dependencies** ✅
```bash
npm install fluent-ffmpeg @types/fluent-ffmpeg
```
Note: fluent-ffmpeg shows deprecation warning but still functions.

**Step 1.3: Update SDK configuration** ✅
- Verified `settingSources: ["user", "project"]` in ai-client.ts
- Verified `allowedTools` includes `"Skill"` and `"Bash"`
- No changes needed - already configured correctly

---

### Phase 2: Knowledge Skill (editorial-photography) ✅ REFACTORED

**Status:** Refactored (2025-12-19)

**Refactoring Decision:** Original implementation used guideline-based files that allowed LLM improvisation. Refactored to strict template-based approach with exact prompts from Tim workflow spec.

#### Original Approach (Removed)
```
❌ core/camera-fundamentals.md    - Guidelines, allowed interpretation
❌ core/prompt-assembly.md        - Patterns, allowed creativity
❌ styles/fashion-tim.md          - Flexible, "adapt as needed"
❌ templates/injection-blocks.md  - Building blocks, assembly required
❌ templates/style-fuji-velvia.md - Style options, variations
```

#### New Approach (Template-Based)
```
✅ SKILL.md                              - Strict instructions, no improvisation
✅ workflows/tim-workflow-templates.md   - Exact prompts with {PLACEHOLDERS}
```

**Step 2.1: Create SKILL.md** ✅
- Strict "DO NOT improvise" instructions
- Fixed 6-camera angle reference
- Locked style treatment (Fuji Velvia)
- Clear workflow stages

**Step 2.2: Create workflows/tim-workflow-templates.md** ✅ (~350 lines)

Contains exact prompts for each pipeline stage:

| Template | Purpose | Adaptable Parts |
|----------|---------|-----------------|
| `HERO_PROMPT` | Full-body hero shot | `{SUBJECT}`, `{WARDROBE}`, `{ACCESSORIES}`, `{POSE}`, `{BACKGROUND}` |
| `CONTACT_SHEET_PROMPT` | 6-angle grid | `{STYLE_DETAILS}` only |
| `FRAME_ISOLATION_PROMPT` | Extract single frame | `{ROW}`, `{COLUMN}` |
| `VIDEO_PROMPTS` | Camera movements | None - fixed per frame type |

**Key Design Decisions:**

1. **Fixed Elements (Never Change):**
   - 6 camera angles (beauty, high-angle, low-angle, side-on, intimate, detail)
   - Style treatment (Fuji Velvia, overexposed, grain, 3:2)
   - Pipeline stages and order
   - Video movement patterns per frame type

2. **Adaptable Elements (From Reference Analysis):**
   - Subject description (age, gender, features)
   - Wardrobe details (garments, fit, colors)
   - Accessories (specific items)
   - Pose and expression
   - Background color

3. **Analysis Phase:**
   - Agent MUST analyze reference images first
   - Extract: SUBJECT, WARDROBE, ACCESSORIES, POSE, BACKGROUND
   - Fill placeholders with extracted details
   - No creative interpretation allowed

---

### Phase 3: Action Skill (fashion-shoot-pipeline) ✅

**Status:** Complete (2025-12-19)

**Step 3.1: Create SKILL.md** ✅
- Script execution instructions
- Clear dependency on editorial-photography skill for prompts
- "Do NOT write your own prompts" instruction

**Step 3.2: Create scripts/generate-image.ts** ✅

Purpose: Wrapper for FAL.ai nano-banana-pro/edit API (image-to-image)

```bash
# Usage
npx tsx scripts/generate-image.ts \
  --prompt "Editorial fashion photo..." \
  --input ref1.jpg --input ref2.jpg \
  --output hero.png \
  --aspect-ratio 3:2 \
  --resolution 2K
```

Features:
- Text-to-image and image-to-image modes
- Multiple reference image support
- Configurable aspect ratio and resolution

**Step 3.3: Create scripts/generate-video.ts** ✅

Purpose: Wrapper for FAL.ai Kling 2.6 Pro image-to-video API

```bash
# Usage
npx tsx scripts/generate-video.ts \
  --input frame-1.png \
  --prompt "Camera slowly pushes in..." \
  --output video-1.mp4 \
  --duration 5
```

Features:
- 5s or 10s video duration
- Optional audio generation
- Async polling with progress logs

**Step 3.4: Create scripts/stitch-videos.ts** ✅

Purpose: FFmpeg video stitching with smooth easing transitions

```bash
# Usage (recommended for fashion)
npx tsx scripts/stitch-videos.ts \
  --clips video-1.mp4 --clips video-2.mp4 ... \
  --output final.mp4 \
  --transition fade \
  --easing smooth \
  --transition-duration 1.2
```

Features:
- **16 easing curves:** linear, quadratic-*, cubic-*, quartic-*, quintic-*, sinusoidal-*, smooth, luxurious, cinematic
- **13 transitions:** fade, fadeblack, fadewhite, wipe*, slide*, circle*, dissolve
- Custom FFmpeg expressions via xfade filter
- Auto-detects clip durations via ffprobe
- Recommended: `--transition fade --easing smooth --transition-duration 1.2`

Implementation Details:
- Uses `transition=custom` with `expr` parameter for easing
- Easing stored in `st(0)`, transitions read from `ld(0)`
- Requires `-filter_complex_threads 1` for state variables
- Based on xfade-easing project expressions

---

### Phase 4: Orchestrator System Prompt Update ✅

**Status:** Complete (2025-12-19)

**Step 4.1: Update server/lib/orchestrator-prompt.ts** ✅

Updated with comprehensive system prompt (~215 lines) that includes:

1. **CRITICAL RULES section** - NO IMPROVISATION, fixed camera angles, fixed style
2. **Role definition** - Pipeline executor, not creative director
3. **Pipeline stages** - Clear 6-stage breakdown
4. **Step-by-step instructions** - Exact commands for each stage
5. **File structure** - Output directory conventions
6. **Error handling** - What to do when things fail
7. **What NOT to do** - Explicit prohibitions

Key features:
- Instructs agent to read `tim-workflow-templates.md` first
- Shows exact bash commands for each script
- Includes all 6 frame isolation prompts
- Includes all 6 video movement prompts
- Specifies exact stitch settings (fade/smooth/1.2s)
- Quick reference table at the end

---

### Phase 5: Session Management Integration ✅

**Status:** Complete (2025-12-19)

**Step 5.1: Update session-manager.ts** ✅

Added pipeline tracking types and methods:

```typescript
// New types
type PipelineStage = 'initialized' | 'analyzing' | 'generating-hero' |
  'generating-contact-sheet' | 'isolating-frames' | 'generating-videos' |
  'stitching' | 'completed' | 'error';

interface PipelineAssets {
  hero?: string;
  contactSheet?: string;
  frames: string[];      // frame-1.png through frame-6.png
  videos: string[];      // video-1.mp4 through video-6.mp4
  finalVideo?: string;
}
```

New methods:
| Method | Purpose |
|--------|---------|
| `createSessionDirectories(sessionId)` | Creates outputs/, frames/, videos/, final/ |
| `getSessionOutputDir(sessionId)` | Returns output directory path |
| `updatePipelineStage(sessionId, stage)` | Updates current pipeline stage |
| `addInputImages(sessionId, paths)` | Records reference image paths |
| `addAsset(sessionId, type, path)` | Records generated asset paths |
| `getPipelineStatus(sessionId)` | Returns stage, assets, progress % |
| `getSessionAssets(sessionId)` | Returns all generated assets |

**Step 5.2: Update sdk-server.ts** ✅

New endpoints:
| Endpoint | Purpose |
|----------|---------|
| `GET /sessions/:id/pipeline` | Get pipeline status and progress |
| `GET /sessions/:id/assets` | Get all generated asset paths |

Updated `/generate` endpoint:
- Now accepts `inputImages` array in request body
- Creates session directories before generation
- Returns `outputDir` and `pipeline` status in response
- Records pipeline errors on failure

---

### Phase 6: Testing & Validation

**Step 6.1: Test individual scripts**
```bash
# Test image generation
npx tsx scripts/generate-image.ts --prompt "test" --output test.png

# Test video generation
npx tsx scripts/generate-video.ts --input test.png --prompt "slow zoom" --output test.mp4

# Test video stitching
npx tsx scripts/stitch-videos.ts --clips a.mp4 b.mp4 --output final.mp4
```

**Step 6.2: Test skills in isolation**
- Verify editorial-photography provides exact templates
- Verify fashion-shoot-pipeline executes scripts correctly
- Verify agent does NOT improvise prompts

**Step 6.3: End-to-end test**
- Provide reference images + prompt
- Verify full pipeline execution with exact Tim workflow
- Check final video output quality

---

## File Changes Summary

### Current Skill Structure
```
agent/.claude/skills/
├── editorial-photography/
│   ├── SKILL.md                        # Strict template-based instructions
│   └── workflows/
│       └── tim-workflow-templates.md   # Exact prompts with {PLACEHOLDERS}
│
└── fashion-shoot-pipeline/
    ├── SKILL.md                        # Script execution instructions
    └── scripts/
        ├── generate-image.ts           # FAL.ai image generation
        ├── generate-video.ts           # FAL.ai video generation
        └── stitch-videos.ts            # FFmpeg video stitching
```

### Modified Files (Complete)
```
server/lib/orchestrator-prompt.ts  # Update system prompt (Phase 4) ✅
server/lib/session-manager.ts      # Add directory management (Phase 5) ✅
server/sdk-server.ts               # Update endpoint handling (Phase 5) ✅
```

---

## Implementation Order

1. **Phase 1** - Project setup, directories, dependencies ✅
2. **Phase 2** - Knowledge skill (editorial-photography) - template-based ✅
3. **Phase 3** - Action skill scripts ✅
4. **Phase 4** - Orchestrator prompt update ✅
5. **Phase 5** - Session management integration ✅
6. **Phase 6** - Testing & Validation ⏳

---

## Success Criteria

### Scripts (Phase 3) ✅
- [x] `generate-image.ts` generates images via FAL.ai nano-banana-pro
- [x] `generate-video.ts` generates videos via FAL.ai Kling 2.6
- [x] `stitch-videos.ts` stitches videos with smooth easing transitions

### Skills (Phase 2) ✅
- [x] editorial-photography provides exact prompt templates
- [x] Templates have clear {PLACEHOLDERS} for reference details
- [x] Camera angles and style blocks are FIXED (not adaptable)
- [x] fashion-shoot-pipeline references templates correctly

### Pipeline End-to-End (Phase 6 - Testing)
- [ ] Agent analyzes reference images and extracts details
- [ ] Agent fills templates with extracted details (no improvisation)
- [ ] Hero image generates using exact HERO_PROMPT template
- [ ] Contact sheet generates with exact 6 camera angles
- [ ] All 6 frames isolate correctly
- [ ] All 6 videos generate with predefined camera movements
- [ ] Final video stitches with fade/smooth/1.2s transitions
- [ ] Full pipeline completes in single agent session
