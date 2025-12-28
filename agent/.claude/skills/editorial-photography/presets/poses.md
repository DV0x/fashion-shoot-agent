# Pose Presets

Select a pose preset to define the subject's body position, stance, and energy in the generated images.

---

## Available Presets

### 1. Confident Standing (Default)

**Name:** `confident-standing`

**Prompt Snippet:**
```
standing with weight shifted to one leg, hand resting on hip, shoulders back with chin slightly lifted, direct confident gaze at camera, editorial attitude
```

**Best For:** Studio shots, editorial campaigns, hero images

---

### 2. Seated Editorial

**Name:** `seated-editorial`

**Prompt Snippet:**
```
sitting elegantly on floor or low surface, relaxed upright posture, legs arranged gracefully, contemplative gaze, one hand resting naturally
```

**Best For:** Warm daylight, intimate studio settings

---

### 3. Leaning Casual

**Name:** `leaning-casual`

**Prompt Snippet:**
```
leaning against wall or surface, relaxed shoulders, weight shifted to one side, approachable energy, soft natural gaze
```

**Best For:** Industrial backgrounds, casual editorial

---

### 4. Editorial Drama

**Name:** `editorial-drama`

**Prompt Snippet:**
```
angular high-fashion pose, strong geometric body shapes, dramatic tension in posture, intense editorial presence, fashion-forward attitude
```

**Best For:** Studio black, color gel, high-fashion campaigns

---

### 5. Relaxed Natural

**Name:** `relaxed-natural`

**Prompt Snippet:**
```
soft candid posture, natural unstaged stance, weight balanced, effortless and authentic feel, gentle expression
```

**Best For:** Warm daylight, outdoor urban, lifestyle shoots

---

### 6. Street Walk

**Name:** `street-walk`

**Prompt Snippet:**
```
mid-stride walking motion, confident urban walk, natural arm movement, city energy, looking ahead or glancing at camera
```

**Best For:** Outdoor urban, street style campaigns

---

### 7. Urban Lean

**Name:** `urban-lean`

**Prompt Snippet:**
```
leaning against urban surface like wall or railing, street style attitude, one foot against wall, relaxed but intentional pose
```

**Best For:** Industrial, outdoor urban, street fashion

---

## Custom Pose

If none of the presets fit, provide a custom pose description following this format:

```
[body position], [weight distribution], [hand/arm placement], [expression/gaze], [overall energy]
```

**Example Custom:**
```
crouching low with one knee on ground, weight forward, hands adjusting shoe, looking up at camera with playful smirk, dynamic street energy
```

---

## Usage

When generating images, the selected pose preset snippet replaces `{POSE_PRESET_SNIPPET}` in the HERO_PROMPT template.
