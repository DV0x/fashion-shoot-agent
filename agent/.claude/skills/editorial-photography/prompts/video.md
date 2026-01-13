# TRANSITION_PROMPTS (5 videos + optional loop)

Frame-pair interpolation prompts for Kling AI with `image_tail` parameter.

**Important:** When using `image_tail` for frame pairs, `camera_control` JSON is not available.
Describe camera movements in the text prompt using camera language.

---

## Video 1: Beauty Portrait → High-Angle 3/4 (frames 1→2)

**Movement:** Jib Up + Arc

```
The camera slowly rises on a jib arm while orbiting from front to three-quarter angle.
The fashion model's gaze lifts upward as the perspective shifts.
The movement is smooth and deliberate. Cinematic quality.
The subject transitions gracefully between poses.
```

---

## Video 2: High-Angle 3/4 → Low-Angle Full Body (frames 2→3)

**Movement:** Descending Arc

```
The camera descends dramatically from overhead position down toward ground level.
The camera sweeps in a smooth arc as it falls.
The model's posture elongates as the perspective shifts from above to below.
Slow, sweeping motion. The subject's movements are extremely deliberate and precise.
```

---

## Video 3: Low-Angle Full Body → Side Profile (frames 3→4)

**Movement:** Low Dolly Arc

```
The camera arcs at low level around the subject, revealing a profile silhouette.
The dolly movement is smooth and cinematic.
The model turns gracefully as the camera orbits.
The background is completely still. Shallow depth of field.
```

---

## Video 4: Side Profile → Close Portrait (frames 4→5)

**Movement:** Dolly In

```
The camera slowly dollies in toward the subject's face from profile view.
Smooth push-in movement. The model's expression softens.
The focal length creates a subtle compression effect.
Shallow depth of field. The subject is completely still.
```

---

## Video 5: Close Portrait → Extreme Detail (frames 5→6)

**Movement:** Macro Push

```
The camera slowly and smoothly pushes in on fabric texture and details.
Macro-like creep movement toward the garment element.
The subject is completely still. The fabric and accessories are completely still.
Extreme close-up reveals intricate texture and craftsmanship.
```

---

## Video 6: Loop (Extreme Detail → Beauty Portrait) (frames 6→1) — OPTIONAL

**Movement:** Pull Back + Arc

**When to use:** Only generate this clip when user requests "loop" or "enable loop"

```
The camera slowly pulls back and arcs upward, transitioning from extreme detail to wide portrait view.
Smooth pull-back movement revealing the full subject.
The composition gracefully returns to the opening frame.
Cinematic dolly-out motion. The subject is completely still.
```

---

## Prompt Writing Tips

- Describe camera equipment + motion: "slowly and smoothly dollies", "lifts on a jib arm"
- Use positive prompting: "The subject is completely still" (not "does not move")
- Prescribe stillness: "background is completely still"
- For pose changes: "The subject's movements are extremely deliberate and precise"
- Frame-pair mode interpolates between start and end frame automatically

---

## Camera Language Reference

Key terms to use in prompts:

| Term | Description |
|------|-------------|
| "camera slowly rises" | Vertical upward movement |
| "camera descends" | Vertical downward movement |
| "camera arcs/orbits around" | Circular movement around subject |
| "camera dollies in/out" | Forward/backward movement |
| "jib arm" | Vertical boom movement |
| "slow push-in" | Gradual forward movement |
| "creep movement" | Very slow, subtle movement |
| "cinematic quality" | Professional, film-like motion |
| "smooth motion" | No jerks or sudden changes |
