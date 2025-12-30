# Session Summary: Skills Reorganization
**Date:** 2025-12-30

## Objective

Analyzed and reorganized the Claude Agent SDK skills for the fashion-shoot-agent project based on SDK best practices from the official documentation.

---

## Research Conducted

### 1. Claude Agent SDK Skills Documentation Analysis

Used `claude-sdk-navigator` agent to study:
- `/claude_sdk/Agent_skills.md` - How skills are loaded and invoked
- `/claude_sdk/skill_creator.md` - Best practices for skill authoring

### Key Findings:

| Topic | Finding |
|-------|---------|
| **Skill Invocation** | Skills are activated via the **Skill tool** (not Read tool). Must include `"Skill"` in `allowedTools` |
| **Loading Mechanism** | Two-phase: metadata (name/description) pre-loaded at startup; full content loaded on-demand when triggered |
| **SKILL.md Max Lines** | Recommended < 500 lines for optimal performance |
| **Progressive Disclosure** | SKILL.md should be an index pointing to reference files |
| **Reference Depth** | Keep references 1 level deep from SKILL.md |
| **Description Best Practice** | Write in third person; include WHAT it does AND WHEN to use it |

### 2. Original Workflow Spec Comparison

Compared implementation against `/workflow-docs/CONTACT_SHEET_TIM_WORKFLOW_SPEC.md`:

| Component | Original Spec | Our Implementation | Match |
|-----------|---------------|-------------------|-------|
| HERO_PROMPT structure | Fixed pose/background | Template with presets | ✅ Improved |
| CONTACT_SHEET_PROMPT | Word-for-word | Word-for-word | ✅ Exact |
| 6 Camera Angles | All 6 defined | All 6 preserved | ✅ Exact |
| Style Treatment | Fuji Velvia block | Preserved exactly | ✅ Exact |
| Frame Extraction | Prompt-based isolation | Programmatic (crop-frames.ts) | ✅ Better |
| Video Generation | Not in spec | Our addition | ✅ Extension |

---

## Issues Identified (Before)

### Redundancy in Old Structure

| Content | Locations | Problem |
|---------|-----------|---------|
| Style block | SKILL.md, HERO_PROMPT, CONTACT_SHEET_PROMPT | Duplicated 3× |
| VIDEO_PROMPTS | SKILL.md summary table + workflow file | Duplicated 2× |
| 6 Camera Angles | SKILL.md diagram + CONTACT_SHEET_PROMPT | Duplicated 2× |
| Preset compatibility | SKILL.md + poses.md + backgrounds.md | Scattered |
| Script commands | tim-workflow-templates.md + fashion-shoot-pipeline | Cross-skill coupling |

### Old Structure

```
editorial-photography/
├── SKILL.md                           (82 lines - had redundancy)
├── presets/
│   ├── poses.md                       (118 lines)
│   └── backgrounds.md                 (132 lines)
└── workflows/
    └── tim-workflow-templates.md      (340 lines - mixed concerns)
```

---

## Solution Implemented (Option 2: Clean Separation)

### Design Principles Applied

1. **Content vs Execution Separation**
   - `editorial-photography` = Content (prompts, presets, templates)
   - `fashion-shoot-pipeline` = Execution (scripts, commands)

2. **Progressive Disclosure**
   - SKILL.md is an index (~80 lines)
   - Details in separate files loaded on-demand

3. **Single Source of Truth**
   - Each piece of content appears exactly once
   - No cross-skill duplication

4. **Correct Skill Tool Usage**
   - Orchestrator uses "Skill tool" language (not "read skill")

### New Structure

```
editorial-photography/
├── SKILL.md                    (80 lines)  ← Index + rules + quick mapping
├── presets/
│   └── options.md              (116 lines) ← Combined poses + backgrounds
└── prompts/
    ├── hero.md                 (70 lines)  ← HERO_PROMPT template
    ├── contact-sheet.md        (117 lines) ← CONTACT_SHEET_PROMPT
    └── video.md                (104 lines) ← 6 VIDEO_PROMPTS

fashion-shoot-pipeline/
├── SKILL.md                    (193 lines) ← Script documentation only
└── scripts/
    ├── generate-image.ts
    ├── crop-frames.ts
    ├── generate-video.ts
    └── stitch-videos.ts
```

---

## Files Changed

### Created

| File | Lines | Purpose |
|------|-------|---------|
| `editorial-photography/SKILL.md` | 80 | Rewritten as clean index |
| `editorial-photography/presets/options.md` | 116 | Combined all presets |
| `editorial-photography/prompts/hero.md` | 70 | HERO_PROMPT template |
| `editorial-photography/prompts/contact-sheet.md` | 117 | CONTACT_SHEET_PROMPT |
| `editorial-photography/prompts/video.md` | 104 | 6 VIDEO_PROMPTS |

### Updated

| File | Change |
|------|--------|
| `fashion-shoot-pipeline/SKILL.md` | Updated prerequisite section, clarified Skill tool usage |
| `server/lib/orchestrator-prompt.ts` | Changed to "Skill tool" language, clearer phase instructions |

### Deleted

| File | Reason |
|------|--------|
| `editorial-photography/presets/poses.md` | Merged into options.md |
| `editorial-photography/presets/backgrounds.md` | Merged into options.md |
| `editorial-photography/workflows/tim-workflow-templates.md` | Split into prompt files |

---

## Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total lines (editorial skill) | ~670 | ~487 | **-27%** |
| SKILL.md lines | 82 | 80 | Under 500 ✅ |
| Preset files | 2 | 1 | Fewer reads |
| Prompt files | 0 (embedded) | 3 | Better separation |
| Redundant content instances | 7+ | 0 | **Eliminated** |

---

## Skill Chain Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│              ORCHESTRATOR SYSTEM PROMPT                          │
│              (server/lib/orchestrator-prompt.ts)                 │
│                                                                  │
│  "Use Skill tool to activate skills in this order..."           │
└──────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│ Skill tool activates:    │    │ Skill tool activates:    │
│ editorial-photography    │───▶│ fashion-shoot-pipeline   │
│                          │    │                          │
│ PROVIDES:                │    │ PROVIDES:                │
│ - Preset snippets        │    │ - generate-image.ts docs │
│ - HERO_PROMPT template   │    │ - crop-frames.ts docs    │
│ - CONTACT_SHEET_PROMPT   │    │ - generate-video.ts docs │
│ - VIDEO_PROMPTS (×6)     │    │ - stitch-videos.ts docs  │
└──────────────────────────┘    └──────────────────────────┘
```

---

## How Skills Chain Together

Based on SDK documentation research, skills chain through:

1. **Description keywords**: "Use FIRST", "Use AFTER" in YAML frontmatter
2. **Cross-references in body**: Skills reference each other by name
3. **Orchestrator coordination**: System prompt enforces order

### Skill Descriptions (Updated)

**editorial-photography:**
```yaml
description: Provides prompt templates and presets for Tim workflow editorial
fashion photography. Contains HERO_PROMPT, CONTACT_SHEET_PROMPT, and 6
VIDEO_PROMPTS with 7 pose and 7 background presets. Use FIRST before
fashion-shoot-pipeline skill.
```

**fashion-shoot-pipeline:**
```yaml
description: Execute image and video generation scripts using FAL.ai and
FFmpeg. Use AFTER editorial-photography skill. Provides script commands for
generate-image, crop-frames, generate-video, and stitch-videos.
```

---

## Workflow Phases (Orchestrator)

| Phase | Actions | Checkpoint |
|-------|---------|------------|
| **1. Setup** | Upload refs, create dirs, select presets | - |
| **2. Hero** | Fill HERO_PROMPT, generate hero.png | ✅ CHECKPOINT 1 |
| **3. Frames** | Fill CONTACT_SHEET_PROMPT, generate + crop | ✅ CHECKPOINT 2 |
| **4. Videos** | Use VIDEO_PROMPTS ×6, stitch final | Runs to completion |

---

## Verification

```bash
# New file structure
find agent/.claude/skills -name "*.md"
# Output:
# fashion-shoot-pipeline/SKILL.md
# editorial-photography/SKILL.md
# editorial-photography/prompts/contact-sheet.md
# editorial-photography/prompts/hero.md
# editorial-photography/prompts/video.md
# editorial-photography/presets/options.md

# Line counts (all under 500)
wc -l agent/.claude/skills/**/*.md
#  80 editorial-photography/SKILL.md
# 116 editorial-photography/presets/options.md
#  70 editorial-photography/prompts/hero.md
# 117 editorial-photography/prompts/contact-sheet.md
# 104 editorial-photography/prompts/video.md
# 193 fashion-shoot-pipeline/SKILL.md
# 680 total
```

---

## Key Learnings

1. **Skill tool vs Read tool**: Skills are activated via dedicated Skill tool, not just read
2. **Progressive disclosure**: SKILL.md should be an index, not contain everything
3. **Description matters**: Claude uses description to match requests to skills
4. **Single source of truth**: Eliminate redundancy by having each piece of content once
5. **Clean separation**: Content skills vs Execution skills prevent coupling

---

## Next Steps (Optional)

- [ ] Test the reorganized skills with actual generation pipeline
- [ ] Consider adding `studio-blue` background preset (matches original Tim spec)
- [ ] Add TOC to contact-sheet.md if it grows beyond 150 lines
