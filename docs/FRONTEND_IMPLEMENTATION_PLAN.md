# Frontend Implementation Plan

## Design Direction: Editorial Darkroom

**Concept:** A high-end fashion magazine meets photo darkroom aesthetic. Dark, cinematic, warm film tones. Everything lives in the chat - images appear like photographs developing.

### Visual Identity

| Element | Specification |
|---------|---------------|
| **Background** | Deep charcoal `#0A0A0A` with subtle warm undertone |
| **Surface** | Elevated cards `#141414` with `1px` border `rgba(255,255,255,0.06)` |
| **Text Primary** | Warm white `#F5F2EE` |
| **Text Secondary** | Muted `#8A8680` |
| **Accent** | Amber/Gold `#C9A66B` (Velvia warmth) |
| **Accent Hover** | Lighter amber `#D4B87A` |
| **Success** | Soft green `#7BAE7F` |
| **Error** | Muted red `#C97B7B` |

### Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| **Logo/Headlines** | Playfair Display | 500 | 24-32px |
| **Body** | Satoshi (or DM Sans fallback) | 400/500 | 15-16px |
| **Captions** | Satoshi | 400 | 13px |
| **Monospace** | JetBrains Mono | 400 | 13px |

### Motion Principles

- **Image reveals:** Slow fade-in (800ms) with subtle scale (0.98 → 1.0) - like photo developing
- **Messages:** Fade up (300ms) with slight Y translation
- **Buttons:** Subtle opacity/color transitions (150ms)
- **Progress:** Smooth width transitions, gentle pulse on active state

---

## Project Structure

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
├── public/
│   └── fonts/                    # Self-hosted fonts
├── src/
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root component
│   ├── index.css                 # Global styles + Tailwind
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppShell.tsx      # Main layout wrapper
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatView.tsx      # Scrollable message container
│   │   │   ├── ChatInput.tsx     # Text input + file upload
│   │   │   ├── Message.tsx       # Base message wrapper
│   │   │   ├── TextMessage.tsx   # Plain text content
│   │   │   ├── ImageMessage.tsx  # Image display (film-frame style)
│   │   │   ├── CheckpointMessage.tsx  # Checkpoint with actions
│   │   │   ├── ProgressMessage.tsx    # Pipeline progress
│   │   │   └── VideoMessage.tsx  # Final video player
│   │   │
│   │   └── ui/
│   │       ├── Button.tsx        # Minimal button variants
│   │       ├── IconButton.tsx    # Icon-only buttons
│   │       └── Spinner.tsx       # Loading indicator
│   │
│   ├── hooks/
│   │   ├── useSession.ts         # Session state management
│   │   ├── useGenerate.ts        # Generation API calls
│   │   └── useSSE.ts             # Server-sent events hook
│   │
│   ├── lib/
│   │   ├── api.ts                # API client
│   │   └── types.ts              # TypeScript types
│   │
│   └── assets/
│       └── logo.svg              # Logo if needed
```

---

## Implementation Steps

### Phase 1: Project Setup

**Step 1.1: Scaffold Vite + React + TypeScript**
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 1.2: Install Dependencies**
```bash
npm install tailwindcss postcss autoprefixer
npm install framer-motion
npm install clsx
npx tailwindcss init -p
```

**Step 1.3: Configure Tailwind**
- Extend colors with our palette
- Add custom fonts
- Configure content paths

**Step 1.4: Set Up Global Styles**
- Import fonts (Google Fonts or self-hosted)
- CSS variables for design tokens
- Base resets and typography

---

### Phase 2: Core Layout

**Step 2.1: AppShell Component**
```
┌─────────────────────────────────────┐
│  Header (optional - just logo)      │
├─────────────────────────────────────┤
│                                     │
│         ChatView (flex-1)           │
│         - scrollable                │
│         - centered content          │
│         - max-width: 680px          │
│                                     │
├─────────────────────────────────────┤
│         ChatInput (sticky)          │
└─────────────────────────────────────┘
```

**Step 2.2: ChatView Component**
- Flex column layout
- Auto-scroll to bottom on new messages
- Padding and max-width constraints
- Messages rendered as children

**Step 2.3: ChatInput Component**
- Textarea with auto-resize
- File upload button (paperclip icon)
- Send button
- Subtle border, focus states
- File preview thumbnails when images attached

---

### Phase 3: Message Components

**Step 3.1: Message Base**
- Wrapper with role-based alignment (user right, assistant left)
- Fade-in animation on mount
- Timestamp (optional, subtle)

**Step 3.2: TextMessage**
- Clean typography
- Markdown support (optional, basic)
- Links styled with accent color

**Step 3.3: ImageMessage**
- Film-frame aesthetic:
  ```
  ┌──────────────────────────────┐
  │ ┌──────────────────────────┐ │
  │ │                          │ │
  │ │        [IMAGE]           │ │
  │ │                          │ │
  │ └──────────────────────────┘ │
  │  hero.png                    │
  └──────────────────────────────┘
  ```
- Subtle border like contact sheet frame
- Caption below with filename
- Click to expand/fullscreen
- **Develop animation:** Opacity 0→1 over 800ms, slight scale

**Step 3.4: CheckpointMessage**
- Shows checkpoint info
- Action buttons inline:
  ```
  ┌─────────────────────────────────────┐
  │ Hero image generated.               │
  │                                     │
  │ [Continue →]  [Modify]              │
  └─────────────────────────────────────┘
  ```
- Buttons are text-style, not chunky pills
- Clear visual hierarchy

**Step 3.5: ProgressMessage**
- Pipeline stage indicator
- Progress bar (thin, elegant)
- Current step text
  ```
  ┌─────────────────────────────────────┐
  │ Generating videos...                │
  │ ████████████░░░░░░░░  4/6           │
  └─────────────────────────────────────┘
  ```

**Step 3.6: VideoMessage**
- Native video player
- Custom minimal controls (optional)
- Download button
- Poster frame from first frame

---

### Phase 4: API Integration

**Step 4.1: API Client (`lib/api.ts`)**
```typescript
const API_BASE = 'http://localhost:3002';

export const api = {
  generate: (prompt: string, sessionId?: string, images?: File[]) => {...},
  continueSession: (sessionId: string, prompt: string) => {...},
  getSession: (sessionId: string) => {...},
  getAsset: (sessionId: string, path: string) => {...},
};
```

**Step 4.2: useSession Hook**
- Manages session ID
- Stores message history
- Handles checkpoint state
- Persists to localStorage (optional)

**Step 4.3: useGenerate Hook**
- Calls generate/continue endpoints
- Parses response
- Updates session state
- Handles loading/error states

**Step 4.4: useSSE Hook (optional for v1)**
- Connects to `/sessions/:id/stream`
- Real-time progress updates
- Can defer to v2 if time-constrained

---

### Phase 5: Wire Up Flow

**Step 5.1: Initial State**
- Show welcome message from agent
- "Upload reference images to begin"
- ChatInput ready for upload

**Step 5.2: Upload + Generate**
- User uploads image(s) + types prompt
- Show user message with image thumbnails
- Call `/generate` API
- Show loading state
- On response: render agent messages, images, checkpoints

**Step 5.3: Checkpoint Handling**
- When `awaitingInput: true` in response
- Render CheckpointMessage with buttons
- "Continue" → calls `/sessions/:id/continue` with "continue"
- "Modify" → enables text input for modification prompt

**Step 5.4: Progress Display**
- During video generation phase
- Show ProgressMessage updating
- (v1: poll session status, v2: SSE)

**Step 5.5: Final Output**
- Render VideoMessage with final video
- Download button
- "Start new shoot" option

---

### Phase 6: Polish

**Step 6.1: Animations**
- Framer Motion for message entry
- Image develop effect
- Smooth scroll behavior

**Step 6.2: Responsive**
- Mobile-first (already planned)
- Tablet/desktop: slightly wider max-width

**Step 6.3: Error Handling**
- API errors shown as system messages
- Retry options
- Graceful degradation

**Step 6.4: Loading States**
- Skeleton loaders for images
- Typing indicator for agent responses
- Subtle, not distracting

---

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/generate` | POST | Start generation with images |
| `/sessions/:id/continue` | POST | Continue after checkpoint |
| `/sessions/:id` | GET | Get session status |
| `/sessions/:id/pipeline` | GET | Get pipeline progress |
| `/sessions/:id/stream` | GET (SSE) | Real-time updates |

**Asset URLs:**
- Images: `http://localhost:3002/sessions/:id/assets/outputs/hero.png`
- Need to verify asset serving endpoint exists

---

## Component Props (Draft)

```typescript
// Message types
type MessageRole = 'user' | 'assistant' | 'system';

interface BaseMessage {
  id: string;
  role: MessageRole;
  timestamp: Date;
}

interface TextContent {
  type: 'text';
  content: string;
}

interface ImageContent {
  type: 'image';
  src: string;
  alt?: string;
  caption?: string;
}

interface CheckpointContent {
  type: 'checkpoint';
  stage: 'hero' | 'frames';
  artifact?: string;
  message: string;
  actions: Array<{
    label: string;
    action: 'continue' | 'modify';
  }>;
}

interface ProgressContent {
  type: 'progress';
  stage: string;
  current: number;
  total: number;
  message: string;
}

interface VideoContent {
  type: 'video';
  src: string;
  poster?: string;
}

type MessageContent = TextContent | ImageContent | CheckpointContent | ProgressContent | VideoContent;

interface ChatMessage extends BaseMessage {
  content: MessageContent[];
}
```

---

## Decisions (Confirmed)

1. **Asset serving:** ✅ Done - Added `/outputs` static file serving to backend

2. **File upload:** Multi-file upload support
   - Add `POST /upload` endpoint to backend (accepts multipart/form-data)
   - Returns array of file paths
   - Frontend allows multiple image uploads (subject + accessories/references)

3. **Presets:** ✅ Include in v1
   - 7 pose presets + 7 background presets
   - Show in expandable "Options" section or bottom sheet
   - Read from `agent/.claude/skills/editorial-photography/presets/`

4. **Real-time updates:** ✅ SSE streaming
   - Use existing `/sessions/:id/stream` endpoint
   - Real-time progress during generation

---

## Success Criteria

- [x] User can upload image and type prompt
- [x] Generation starts and shows progress
- [ ] Hero checkpoint pauses for user decision
- [ ] Frames checkpoint pauses for user decision
- [ ] Videos generate with progress shown
- [ ] Final video displayed with download option
- [x] Clean, editorial aesthetic throughout
- [x] Mobile-responsive layout
- [x] No "school project" vibes

---

## Completed Backend Prep

### 1. Static File Serving (✅ Done)
Added to `server/sdk-server.ts`:
```typescript
// Serve generated assets from agent/outputs
app.use('/outputs', express.static(path.join(__dirname, '../agent/outputs')));

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));
```

**Asset URLs now available:**
- `http://localhost:3002/outputs/hero.png`
- `http://localhost:3002/outputs/frames/frame-1.png`
- `http://localhost:3002/outputs/videos/video-1.mp4`
- `http://localhost:3002/outputs/final/fashion-video.mp4`
- `http://localhost:3002/uploads/{filename}` (user uploads)

### 2. Multi-File Upload Endpoint (✅ Done)
Added `POST /upload` endpoint:
```typescript
app.post('/upload', upload.array('images', 10), (req, res) => {...})
```

**Request:** `multipart/form-data` with field name `images` (up to 10 files)

**Response:**
```json
{
  "success": true,
  "count": 2,
  "files": [
    {
      "originalName": "model.jpg",
      "filename": "1735123456789-123456789.jpg",
      "path": "/path/to/uploads/1735123456789-123456789.jpg",
      "size": 245678,
      "mimetype": "image/jpeg",
      "url": "/uploads/1735123456789-123456789.jpg"
    }
  ]
}
```

**Constraints:**
- Max file size: 10MB per file
- Allowed types: JPEG, PNG, WebP, GIF
- Max files: 10 per upload

---

## Implementation Status

### Phase 1: Project Setup (Completed)
- [x] Scaffold Vite + React + TypeScript project
- [x] Install dependencies (Tailwind v4, Framer Motion)
- [x] Configure Tailwind with custom design tokens
- [x] Set up global styles and fonts (Playfair Display, DM Sans, JetBrains Mono)
- [x] Configure Vite proxy for API calls

### Phase 2: Core Layout (Completed)
- [x] Build AppShell component
- [x] Build ChatView component
- [x] Build ChatInput with multi-file upload

### Phase 3: Message Components (Completed)
- [x] Build TextMessage component with markdown rendering (react-markdown)
- [x] Build ImageMessage component (film-frame aesthetic)
- [x] Build CheckpointMessage with action buttons
- [x] Build ProgressMessage with progress bar
- [x] Build VideoMessage with download

### Phase 4: Features (Completed)
- [x] Implement API client (`lib/api.ts`)
- [x] Implement useStreamingGenerate hook (replaces useSession + useGenerate)
- [x] Implement real-time SSE streaming
- [ ] Build PresetPicker (7 poses + 7 backgrounds) - TODO

### Phase 5: Integration (In Progress)
- [x] Wire up full user flow
- [ ] Test checkpoint interactions - TODO
- [x] Test SSE streaming
- [ ] Polish animations and transitions - TODO

---

## Session Summary (2024-12-28)

### What Was Implemented

#### Frontend Setup
Created a complete React frontend in `frontend/` with:
- **Vite** + **React** + **TypeScript** scaffolding
- **Tailwind CSS v4** with custom theme (Editorial Darkroom)
- **Framer Motion** for animations
- Vite proxy configuration for API calls to backend

#### UI Components
| Component | Location | Description |
|-----------|----------|-------------|
| `AppShell` | `components/layout/` | Main layout with header and footer |
| `ChatView` | `components/chat/` | Scrollable message container |
| `ChatInput` | `components/chat/` | Text input + multi-file upload |
| `TextMessage` | `components/chat/` | Markdown-rendered text messages |
| `ImageMessage` | `components/chat/` | Film-frame styled images with lightbox |
| `CheckpointMessage` | `components/chat/` | Checkpoint display with action buttons |
| `ProgressMessage` | `components/chat/` | Pipeline progress bar |
| `VideoMessage` | `components/chat/` | Video player with download |
| `Button` | `components/ui/` | Primary/secondary/ghost variants |
| `IconButton` | `components/ui/` | Icon-only buttons |
| `Spinner` | `components/ui/` | Loading indicator |

#### Real-Time Streaming
Implemented token-by-token streaming:

1. **Backend Changes** (`server/lib/ai-client.ts`):
   - Added `includePartialMessages: true` to SDK options
   - SDK now emits `stream_event` messages with text deltas

2. **New Streaming Endpoint** (`server/sdk-server.ts`):
   - `POST /generate-stream` - SSE endpoint for real-time streaming
   - Streams events: `session_init`, `text_delta`, `assistant_message`, `system`, `complete`, `error`

3. **Frontend Hook** (`hooks/useStreamingGenerate.ts`):
   - Consumes SSE stream via `fetch` + `ReadableStream`
   - Accumulates text deltas in real-time
   - Updates message content as tokens arrive

#### Bug Fix: SDK Async Generator
Fixed critical issue where responses weren't being sent:
- **Problem**: Prompt generator had infinite `await new Promise(() => {})` that never resolved
- **Solution**: Added check for `result` message type to abort generator and break loop
- **File**: `server/lib/ai-client.ts` lines 173-178

### Files Created/Modified

#### New Files
```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css (Tailwind + theme)
│   ├── components/
│   │   ├── layout/AppShell.tsx
│   │   ├── chat/ChatView.tsx
│   │   ├── chat/ChatInput.tsx
│   │   ├── chat/TextMessage.tsx
│   │   ├── chat/ImageMessage.tsx
│   │   ├── chat/CheckpointMessage.tsx
│   │   ├── chat/ProgressMessage.tsx
│   │   ├── chat/VideoMessage.tsx
│   │   └── ui/Button.tsx, IconButton.tsx, Spinner.tsx
│   ├── hooks/useStreamingGenerate.ts
│   └── lib/api.ts, types.ts
```

#### Modified Files
- `server/lib/ai-client.ts` - Added `includePartialMessages`, fixed generator termination
- `server/sdk-server.ts` - Added `/generate-stream` endpoint, debug logging

### How to Run

**Terminal 1 - Backend:**
```bash
cd /Users/chakra/Documents/Agents/fashion-shoot-agent
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd /Users/chakra/Documents/Agents/fashion-shoot-agent/frontend
npm run dev
```

Open `http://localhost:5173` in browser.

### Remaining Work
1. **Preset Picker** - UI for selecting pose/background presets
2. **Checkpoint Testing** - Verify pause/continue flow works
3. **Asset Display** - Show generated images/videos inline
4. **Animation Polish** - Image "developing" effect, smooth transitions
5. **Error Handling** - Better error display and retry options

