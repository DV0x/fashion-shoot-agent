# Dynamic Action UI System

## Overview

The Dynamic Action UI system allows workflows to define interactive checkpoint actions in JSON config. The frontend renders these actions automatically using a generic **ActionRenderer** template component - no code changes needed per workflow.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Workflow JSON  │────►│  ActionRenderer │────►│   Dynamic UI    │
│    (data)       │     │   (template)    │     │    (output)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘

New workflow = New JSON file only
Frontend code = Never changes
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW CONFIG                                  │
│                                                                          │
│  checkpoint: {                                                          │
│    actions: [                                                           │
│      { type: "select", label: "Frame", options: [...] },               │
│      { type: "dropdown", label: "Resize", options: [...] },            │
│      { type: "button", label: "Continue" }                              │
│    ]                                                                     │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVER (SSE Event)                               │
│                                                                          │
│  {                                                                       │
│    type: "checkpoint",                                                  │
│    checkpoint: {                                                        │
│      stage: "frames",                                                   │
│      artifacts: [...],                                                  │
│      actions: [...]  ◄─── Passed to frontend                           │
│    }                                                                     │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (ActionRenderer)                             │
│                                                                          │
│  <ActionRenderer actions={checkpoint.actions} onSend={sendMessage} />  │
│                                                                          │
│  Maps action.type → UI Component:                                       │
│    "button"       → <Button />                                          │
│    "select"       → <ChipGroup />                                       │
│    "dropdown"     → <Select />                                          │
│    "slider"       → <RangeSlider />                                     │
│    "text-input"   → <TextInput />                                       │
│                                                                          │
│  User clicks → Sends templated message → Agent executes                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Action Schema

Each action in the `actions` array follows this schema:

```typescript
interface Action {
  // Required
  id: string;           // Unique identifier
  type: ActionType;     // UI component type
  label: string;        // Display label
  message: string;      // Message template sent to agent

  // Optional
  param?: string;       // Parameter name for placeholder substitution
  options?: Option[];   // For select/dropdown types
  variant?: Variant;    // Styling variant
  min?: number;         // For slider type
  max?: number;         // For slider type
  step?: number;        // For slider type
  placeholder?: string; // For text-input type
  default?: string;     // Default value
}

interface Option {
  value: string;        // Value sent in message
  label: string;        // Display text
}

type ActionType =
  | 'button'        // Simple click action
  | 'select'        // Single select from chips
  | 'multi-select'  // Multiple select checkboxes
  | 'dropdown'      // Dropdown menu
  | 'slider'        // Range slider
  | 'text-input';   // Free text input

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
```

---

## Action Types

### 1. Button

Simple click action.

```json
{
  "id": "continue",
  "type": "button",
  "label": "Continue",
  "variant": "primary",
  "message": "continue"
}
```

**Renders:**
```
[Continue →]
```

**On click:** Sends `"continue"` to agent.

---

### 2. Select (Chips)

Single selection from visual chips/buttons.

```json
{
  "id": "modify-frame",
  "type": "select",
  "label": "Modify Frame",
  "param": "frame",
  "options": [
    { "value": "1", "label": "Frame 1" },
    { "value": "2", "label": "Frame 2" },
    { "value": "3", "label": "Frame 3" },
    { "value": "4", "label": "Frame 4" },
    { "value": "5", "label": "Frame 5" },
    { "value": "6", "label": "Frame 6" }
  ],
  "message": "modify frame {frame}"
}
```

**Renders:**
```
Modify Frame: [1] [2] [3] [4] [5] [6]
```

**On click "3":** Sends `"modify frame 3"` to agent.

---

### 3. Multi-Select (Checkboxes)

Multiple selection with checkboxes.

```json
{
  "id": "select-frames",
  "type": "multi-select",
  "label": "Select Frames",
  "param": "frames",
  "options": [
    { "value": "1", "label": "Frame 1" },
    { "value": "2", "label": "Frame 2" },
    { "value": "3", "label": "Frame 3" },
    { "value": "4", "label": "Frame 4" },
    { "value": "5", "label": "Frame 5" },
    { "value": "6", "label": "Frame 6" }
  ],
  "message": "modify frames {frames}"
}
```

**Renders:**
```
Select Frames:
☐ Frame 1  ☐ Frame 2  ☐ Frame 3
☐ Frame 4  ☐ Frame 5  ☐ Frame 6
[Apply]
```

**On check 2,4,5 + Apply:** Sends `"modify frames 2, 4, 5"` to agent.

---

### 4. Dropdown

Dropdown menu for selection.

```json
{
  "id": "resize",
  "type": "dropdown",
  "label": "Resize To",
  "param": "ratio",
  "options": [
    { "value": "9:16", "label": "9:16 (TikTok/Reels)" },
    { "value": "16:9", "label": "16:9 (YouTube)" },
    { "value": "1:1", "label": "1:1 (Instagram Square)" },
    { "value": "4:3", "label": "4:3 (Standard)" }
  ],
  "message": "resize to {ratio}"
}
```

**Renders:**
```
Resize To: [9:16 (TikTok/Reels) ▼] [Apply]
```

**On select "16:9" + Apply:** Sends `"resize to 16:9"` to agent.

---

### 5. Slider

Range slider for numeric values.

```json
{
  "id": "speed",
  "type": "slider",
  "label": "Playback Speed",
  "param": "speed",
  "min": 0.5,
  "max": 2.0,
  "step": 0.25,
  "default": "1",
  "message": "{speed}x speed"
}
```

**Renders:**
```
Playback Speed: 1.5x
[━━━━━━━●━━━━━━━]
[Apply]
```

**On slide to 1.5 + Apply:** Sends `"1.5x speed"` to agent.

---

### 6. Text Input

Free text input for custom values.

```json
{
  "id": "custom-prompt",
  "type": "text-input",
  "label": "Custom Instructions",
  "param": "instructions",
  "placeholder": "Describe changes...",
  "message": "{instructions}"
}
```

**Renders:**
```
Custom Instructions:
[Describe changes...          ]
[Send]
```

**On type "add sunglasses" + Send:** Sends `"add sunglasses"` to agent.

---

## Message Templates

The `message` field supports placeholder substitution:

| Placeholder | Replaced With |
|-------------|---------------|
| `{param}` | Selected value from `param` field |

### Examples

```json
// Single value
{ "param": "frame", "message": "modify frame {frame}" }
// User selects "3" → "modify frame 3"

// Multiple values (multi-select)
{ "param": "frames", "message": "modify frames {frames}" }
// User selects 2,4,5 → "modify frames 2, 4, 5"

// No placeholder
{ "message": "continue" }
// Always sends "continue"
```

---

## Complete Workflow Example

```json
{
  "id": "fashion-editorial",
  "name": "Fashion Editorial",
  "phases": [
    {
      "name": "hero",
      "checkpoint": {
        "artifacts": ["outputs/hero.png"],
        "type": "image",
        "message": "Hero image ready.",
        "actions": [
          {
            "id": "custom-change",
            "type": "text-input",
            "label": "Request Changes",
            "param": "change",
            "placeholder": "e.g., make it more dramatic",
            "message": "{change}"
          },
          {
            "id": "continue",
            "type": "button",
            "label": "Continue",
            "variant": "primary",
            "message": "continue"
          }
        ]
      }
    },
    {
      "name": "frames",
      "checkpoint": {
        "artifacts": ["outputs/frames/frame-1.png", "..."],
        "type": "image-grid",
        "message": "6 frames ready.",
        "actions": [
          {
            "id": "modify-frame",
            "type": "select",
            "label": "Modify Frame",
            "param": "frame",
            "options": [
              { "value": "1", "label": "1" },
              { "value": "2", "label": "2" },
              { "value": "3", "label": "3" },
              { "value": "4", "label": "4" },
              { "value": "5", "label": "5" },
              { "value": "6", "label": "6" }
            ],
            "message": "modify frame {frame}"
          },
          {
            "id": "resize",
            "type": "dropdown",
            "label": "Resize All",
            "param": "ratio",
            "options": [
              { "value": "9:16", "label": "9:16 (TikTok)" },
              { "value": "16:9", "label": "16:9 (YouTube)" },
              { "value": "1:1", "label": "1:1 (Square)" }
            ],
            "message": "resize to {ratio}"
          },
          {
            "id": "continue",
            "type": "button",
            "label": "Continue",
            "variant": "primary",
            "message": "continue"
          }
        ]
      }
    },
    {
      "name": "clips",
      "checkpoint": {
        "artifacts": ["outputs/videos/video-1.mp4", "..."],
        "type": "video-grid",
        "message": "6 clips ready.",
        "actions": [
          {
            "id": "regenerate-clip",
            "type": "select",
            "label": "Regenerate Clip",
            "param": "clip",
            "options": [
              { "value": "1", "label": "1" },
              { "value": "2", "label": "2" },
              { "value": "3", "label": "3" },
              { "value": "4", "label": "4" },
              { "value": "5", "label": "5" },
              { "value": "6", "label": "6" }
            ],
            "message": "regenerate clip {clip}"
          },
          {
            "id": "speed",
            "type": "slider",
            "label": "Speed",
            "param": "speed",
            "min": 0.5,
            "max": 2,
            "step": 0.25,
            "default": "1",
            "message": "{speed}x speed"
          },
          {
            "id": "easing",
            "type": "dropdown",
            "label": "Easing",
            "param": "easing",
            "options": [
              { "value": "dramaticSwoop", "label": "Dramatic Swoop" },
              { "value": "cinematic", "label": "Cinematic" },
              { "value": "linear", "label": "Linear" },
              { "value": "easeInOut", "label": "Ease In-Out" }
            ],
            "message": "use {easing} easing"
          },
          {
            "id": "continue",
            "type": "button",
            "label": "Stitch Video",
            "variant": "primary",
            "message": "continue"
          }
        ]
      }
    }
  ]
}
```

---

## ActionRenderer Component

```typescript
// components/chat/ActionRenderer.tsx

import { useState } from 'react';

interface Action {
  id: string;
  type: 'button' | 'select' | 'multi-select' | 'dropdown' | 'slider' | 'text-input';
  label: string;
  message: string;
  param?: string;
  options?: { value: string; label: string }[];
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  min?: number;
  max?: number;
  step?: number;
  default?: string;
  placeholder?: string;
}

interface ActionRendererProps {
  actions: Action[];
  onSendMessage: (message: string) => void;
}

export function ActionRenderer({ actions, onSendMessage }: ActionRendererProps) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});

  const updateValue = (id: string, value: string | string[]) => {
    setValues(prev => ({ ...prev, [id]: value }));
  };

  const sendAction = (action: Action) => {
    let message = action.message;

    if (action.param) {
      const value = values[action.id];
      if (Array.isArray(value)) {
        message = message.replace(`{${action.param}}`, value.join(', '));
      } else if (value) {
        message = message.replace(`{${action.param}}`, value);
      }
    }

    onSendMessage(message);
  };

  return (
    <div className="action-renderer">
      {actions.map(action => {
        switch (action.type) {
          case 'button':
            return (
              <button
                key={action.id}
                className={`btn btn-${action.variant || 'secondary'}`}
                onClick={() => sendAction(action)}
              >
                {action.label}
              </button>
            );

          case 'select':
            return (
              <div key={action.id} className="action-group">
                <label>{action.label}</label>
                <div className="chip-group">
                  {action.options?.map(opt => (
                    <button
                      key={opt.value}
                      className={`chip ${values[action.id] === opt.value ? 'selected' : ''}`}
                      onClick={() => {
                        updateValue(action.id, opt.value);
                        onSendMessage(action.message.replace(`{${action.param}}`, opt.value));
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );

          case 'multi-select':
            return (
              <div key={action.id} className="action-group">
                <label>{action.label}</label>
                <div className="checkbox-group">
                  {action.options?.map(opt => (
                    <label key={opt.value} className="checkbox">
                      <input
                        type="checkbox"
                        checked={(values[action.id] as string[] || []).includes(opt.value)}
                        onChange={(e) => {
                          const current = (values[action.id] as string[]) || [];
                          const updated = e.target.checked
                            ? [...current, opt.value]
                            : current.filter(v => v !== opt.value);
                          updateValue(action.id, updated);
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <button className="btn btn-secondary" onClick={() => sendAction(action)}>
                  Apply
                </button>
              </div>
            );

          case 'dropdown':
            return (
              <div key={action.id} className="action-group action-row">
                <label>{action.label}</label>
                <select
                  value={(values[action.id] as string) || ''}
                  onChange={(e) => updateValue(action.id, e.target.value)}
                >
                  <option value="">Select...</option>
                  {action.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={() => sendAction(action)}>
                  Apply
                </button>
              </div>
            );

          case 'slider':
            return (
              <div key={action.id} className="action-group">
                <label>
                  {action.label}: {values[action.id] || action.default || action.min}
                </label>
                <input
                  type="range"
                  min={action.min}
                  max={action.max}
                  step={action.step || 1}
                  value={(values[action.id] as string) || action.default || action.min}
                  onChange={(e) => updateValue(action.id, e.target.value)}
                />
                <button className="btn btn-secondary" onClick={() => sendAction(action)}>
                  Apply
                </button>
              </div>
            );

          case 'text-input':
            return (
              <div key={action.id} className="action-group">
                <label>{action.label}</label>
                <input
                  type="text"
                  placeholder={action.placeholder}
                  value={(values[action.id] as string) || ''}
                  onChange={(e) => updateValue(action.id, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendAction(action)}
                />
                <button className="btn btn-secondary" onClick={() => sendAction(action)}>
                  Send
                </button>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
```

---

## Styling (CSS)

```css
/* ActionRenderer.css */

.action-renderer {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-top: 12px;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-row {
  flex-direction: row;
  align-items: center;
}

.action-group label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.chip-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 13px;
}

.chip:hover {
  background: var(--bg-hover);
}

.chip.selected {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-secondary {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
}

.btn-danger {
  background: var(--danger);
  color: white;
}

select, input[type="text"] {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  font-size: 14px;
}

input[type="range"] {
  width: 200px;
}
```

---

## Integration with CheckpointMessage

```typescript
// components/chat/CheckpointMessage.tsx

import { ActionRenderer } from './ActionRenderer';

interface CheckpointMessageProps {
  checkpoint: {
    stage: string;
    message: string;
    artifacts?: string[];
    actions?: Action[];
  };
  onSendMessage: (message: string) => void;
}

export function CheckpointMessage({ checkpoint, onSendMessage }: CheckpointMessageProps) {
  return (
    <div className="checkpoint-message">
      <div className="checkpoint-header">
        <span className="checkpoint-badge">{checkpoint.stage}</span>
        <p>{checkpoint.message}</p>
      </div>

      {/* Render artifacts based on type */}
      {checkpoint.artifacts && (
        <div className="checkpoint-artifacts">
          {/* ImageGrid, VideoGrid, etc. */}
        </div>
      )}

      {/* Dynamic actions from config */}
      {checkpoint.actions && checkpoint.actions.length > 0 && (
        <ActionRenderer
          actions={checkpoint.actions}
          onSendMessage={onSendMessage}
        />
      )}
    </div>
  );
}
```

---

## Server Changes Required

Pass `actions` through checkpoint SSE events:

```typescript
// server/lib/checkpoint-detector.ts

export interface CheckpointData {
  stage: string;
  status: 'complete' | 'error';
  artifacts?: string[];
  type?: string;
  message: string;
  actions?: Action[];  // Add this
  isFinal?: boolean;
}
```

```typescript
// In detect() method, include actions from config
return {
  stage: checkpoint.isFinal ? 'complete' : phase.name,
  status: 'complete',
  artifacts: checkpoint.artifacts,
  type: checkpoint.type,
  message: checkpoint.message,
  actions: checkpoint.actions,  // Pass through
  isFinal: checkpoint.isFinal
};
```

---

## Summary

| Component | Role |
|-----------|------|
| **Workflow JSON** | Defines actions declaratively |
| **CheckpointDetector** | Passes actions to SSE events |
| **SSE Event** | Delivers actions to frontend |
| **ActionRenderer** | Generic template that renders any action |
| **User** | Clicks button → Message sent → Agent executes |

**Result:** Add new workflows with custom actions by editing JSON only. Zero frontend code changes.
