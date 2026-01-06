# VIDEO_PROMPTS

## Creative Direction: High-End Fashion Cinematography

Think like a **fashion film DP** (Director of Photography) working on a high-end editorial or luxury brand campaign. This isn't corporate video—it's moving image art.

### The Mindset

**References:** Nick Knight's SHOWstudio, Solve Sundsbo's beauty films, Steven Meisel's moving editorials, Fabien Baron's commercial work

**The Feeling:** Aspirational, hypnotic, slightly uncomfortable. The viewer should feel like they're glimpsing something exclusive—a private moment made public.

**Visual Language:**
- **Negative space** - What you don't show matters. Let the frame breathe.
- **Tension** - The stillness should feel loaded, not empty
- **Controlled chaos** - Movement should feel inevitable, not random
- **Light as character** - The hard flash creates drama, not just illumination

**Pacing:**
- Slow enough to feel luxurious
- Fast enough to feel modern
- The speed curve creates a "breath" - inhale (slow), hold (fast), exhale (slow)

**The Edit:**
- Each cut should feel like a visual punctuation mark
- The sequence should build—not just show 6 angles, but tell a micro-story
- End stronger than you start

---

## Goal: One Continuous Take Illusion

The 6 video clips will be stitched with hard cuts + speed curves. The goal is to make the final video look like **ONE CONTINUOUS SHOT** - as if a single camera moved through the scene visiting 6 different angles.

### The Formula

```
Speed Curves (slow at cut points) + Aligned Camera Motion + Minimal Subject Movement
= Invisible hard cuts
= One continuous video illusion
```

---

## Key Principles

### 1. Camera Motion Continuity

Each clip's camera movement should **flow into the next**. The end of Clip N should visually connect to the start of Clip N+1.

```
Clip 1: orbits RIGHT → ends moving right
Clip 2: starts from right, descends → ends moving down
Clip 3: starts from above, pushes forward → ends moving forward
...continuous path through all 6 angles
```

### 2. Subject Barely Moves (But Commands the Frame)

The subject must be nearly still throughout all 6 clips—but this stillness should feel **powerful, not passive**. Think: a model who knows they're being watched.

**The Performance:**
- Stillness with presence—owning the space
- Micro-movements only: a slow blink, slight breath, subtle weight shift
- Expression should feel private, internal—not performed for camera
- Any movement is deliberate, inevitable, almost sculptural

**What to Avoid:**
- Empty stillness (mannequin effect)
- Obvious posing or mugging
- Movement that contradicts the previous clip
- Breaking the fourth wall / looking at camera (unless intentional)

### 3. Slow at Boundaries

With speed curves applied (slow-fast-slow), the cuts happen during slow-motion moments. This hides the transition. The prompts should ensure visually similar content at clip boundaries.

---

## Choreographed Sequence

The default 6-frame sequence as ONE continuous camera path:

### CLIP 1 → CLIP 2 (Beauty Portrait → High-Angle)

**Clip 1:** Camera orbits slowly around face, drifting upward-right
**Transition:** Camera continues upward...
**Clip 2:** Camera descends smoothly on boom from above

*Connection: upward drift → overhead position → descending*

### CLIP 2 → CLIP 3 (High-Angle → Low-Angle)

**Clip 2:** Camera descends, ending lower
**Transition:** Camera continues down past subject...
**Clip 3:** Camera at ground level, pushes forward

*Connection: descending → ground level → forward push*

### CLIP 3 → CLIP 4 (Low-Angle → Profile)

**Clip 3:** Camera pushes forward from low angle
**Transition:** Camera sweeps around to side...
**Clip 4:** Camera tracks laterally in profile view

*Connection: forward motion → lateral sweep → side tracking*

### CLIP 4 → CLIP 5 (Profile → Close Portrait)

**Clip 4:** Camera tracks laterally, ending near face
**Transition:** Camera moves closer...
**Clip 5:** Camera drifts slowly near face from unexpected angle

*Connection: lateral track → close approach → intimate drift*

### CLIP 5 → CLIP 6 (Close Portrait → Detail)

**Clip 5:** Camera drifts near face/torso
**Transition:** Camera moves to detail...
**Clip 6:** Camera drifts glacially across texture/accessory

*Connection: close portrait → extreme close-up → macro drift*

---

## Default Prompts (Choreographed)

### VIDEO_PROMPT_1: Beauty Portrait
```
The camera very slowly orbits around the face, drifting gently upward. The subject barely moves, extremely deliberate in any micro-expression.
```

### VIDEO_PROMPT_2: High-Angle
```
The camera smoothly descends on a boom from above. The subject barely moves, extremely deliberate and thoughtful in movement.
```

### VIDEO_PROMPT_3: Low-Angle
```
The camera slowly pushes forward from ground level. The subject barely moves, holding a powerful stance with deliberate stillness.
```

### VIDEO_PROMPT_4: Profile
```
The camera slowly tracks laterally past the subject. The subject barely moves, maintaining a clean profile with deliberate stillness.
```

### VIDEO_PROMPT_5: Close Portrait
```
The camera slowly drifts near the subject's face. The subject barely moves, with a subtle, deliberate expression.
```

### VIDEO_PROMPT_6: Detail
```
The camera drifts glacially across the texture or accessory. Movement is barely perceptible. Abstract and editorial.
```

---

## When User Modifies a Frame

If the user changes a frame's style, the agent must:

1. **Analyze the modified frame** - What is the new content/angle?
2. **Check neighboring clips** - What are clips N-1 and N+1 doing?
3. **Generate a bridging prompt** - Create camera movement that:
   - Starts from where clip N-1 ends
   - Ends where clip N+1 begins
   - Fits the new frame's visual content

### Example: User Changes Frame 3 to "Dramatic Silhouette"

Original sequence:
```
Clip 2: descending from above
Clip 3: [was low-angle push] → [now dramatic silhouette]
Clip 4: lateral tracking
```

Agent generates new prompt for Clip 3:
```
The camera slowly pulls back, revealing the backlit silhouette. Movement transitions from vertical to horizontal. The subject is completely still, a dramatic outline.
```

*This bridges the descending motion (Clip 2) into the lateral motion (Clip 4)*

---

## Summary

| Principle | Implementation |
|-----------|----------------|
| Invisible cuts | Speed curves (slow-fast-slow) at boundaries |
| Camera continuity | Each clip flows into the next |
| Subject stillness | "barely moves" in every prompt |
| One-take illusion | Choreographed camera path through all angles |
| Adaptive prompts | Modified frames get bridging prompts |
