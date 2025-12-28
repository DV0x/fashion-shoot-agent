# Frontend Design Plan: Fashion Shoot Agent

**Created:** 2025-12-28
**Status:** Planning Complete, Ready for Implementation

---

## Table of Contents

1. [Design Direction](#design-direction)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Component Architecture](#component-architecture)
5. [Screen Designs](#screen-designs)
6. [Animation Specifications](#animation-specifications)
7. [Implementation Phases](#implementation-phases)
8. [Tech Stack](#tech-stack)

---

## Design Direction

### Aesthetic: Dark Editorial Studio

Inspired by professional photo editing suites (Capture One, Lightroom) meets luxury fashion magazine aesthetic. A fashion photographer's dark room meets Vogue's digital presence.

### Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Mobile-First** | Single column, bottom sheets, touch-friendly |
| **Dark Theme** | Deep blacks with warm gold accents |
| **Editorial Luxury** | Refined typography, generous spacing |
| **Film Photography** | Grain textures, contact sheet motifs, light leaks |

### The Unforgettable Element

**"Contact Sheet Reveal"** - When the 6-frame grid appears at Checkpoint 2, frames slide in like physical film strips being laid on a light table, with a subtle warm backlight glow. This connects the digital experience to the tactile world of fashion photography.

---

## Color System

```css
:root {
  /* ========== BACKGROUNDS ========== */
  --bg-primary: #0A0A0B;        /* Main background - near black */
  --bg-elevated: #141416;       /* Cards, elevated surfaces */
  --bg-surface: #1C1C1F;        /* Input fields, subtle surfaces */
  --bg-hover: #252528;          /* Hover states */

  /* ========== ACCENT - FUJI VELVIA ========== */
  --accent-gold: #C9A227;       /* Primary accent - warm gold */
  --accent-amber: #E8B84A;      /* Hover/active states */
  --accent-warm: #F5D67A;       /* Highlights, glows */
  --accent-muted: #8B7355;      /* Disabled accent */

  /* ========== TEXT ========== */
  --text-primary: #F5F5F4;      /* Primary text - warm white */
  --text-secondary: #A1A1A6;    /* Secondary text */
  --text-muted: #636366;        /* Muted/placeholder text */
  --text-inverse: #0A0A0B;      /* Text on accent backgrounds */

  /* ========== STATUS ========== */
  --success: #34C759;           /* Completed states */
  --processing: #E8B84A;        /* In-progress (uses accent) */
  --error: #FF453A;             /* Error states */
  --warning: #FF9F0A;           /* Warning states */

  /* ========== EFFECTS ========== */
  --shadow-glow: rgba(201, 162, 39, 0.15);      /* Gold glow */
  --shadow-dark: rgba(0, 0, 0, 0.5);            /* Dark shadows */
  --overlay-dark: rgba(10, 10, 11, 0.85);       /* Modal overlays */
  --overlay-light: rgba(245, 245, 244, 0.05);   /* Subtle highlights */

  /* ========== BORDERS ========== */
  --border-subtle: rgba(255, 255, 255, 0.08);   /* Subtle dividers */
  --border-medium: rgba(255, 255, 255, 0.12);   /* Card borders */
  --border-accent: var(--accent-gold);          /* Accent borders */
}
```

---

## Typography

### Font Stack

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| **Headlines** | Playfair Display | 500, 600 | App title, section headers |
| **Body/UI** | DM Sans | 400, 500, 600 | All UI text, buttons, labels |
| **Mono** | JetBrains Mono | 400 | Progress indicators, technical |

### Type Scale

```css
:root {
  /* Headlines - Playfair Display */
  --text-display: 2rem;      /* 32px - App title */
  --text-headline: 1.5rem;   /* 24px - Section headers */
  --text-title: 1.25rem;     /* 20px - Card titles */

  /* Body - DM Sans */
  --text-body: 1rem;         /* 16px - Primary body */
  --text-caption: 0.875rem;  /* 14px - Secondary text */
  --text-small: 0.75rem;     /* 12px - Labels, hints */

  /* Tracking */
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.05em;
  --tracking-wider: 0.1em;   /* For "FASHION SHOOT" header */
}
```

### Font Loading (Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet">
```

---

## Component Architecture

### Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx           # Main layout wrapper
│   │   │   ├── Header.tsx             # Top bar with title
│   │   │   └── SafeArea.tsx           # Mobile safe area handler
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatView.tsx           # Scrollable message container
│   │   │   ├── Message.tsx            # User/Assistant message bubble
│   │   │   ├── MessageContent.tsx     # Text/image/video content
│   │   │   ├── ChatInput.tsx          # Text input + send button
│   │   │   ├── ActionBar.tsx          # Upload + Options buttons
│   │   │   └── TypingIndicator.tsx    # "..." animation
│   │   │
│   │   ├── media/
│   │   │   ├── ImageUpload.tsx        # Drag-drop + file picker
│   │   │   ├── ImagePreview.tsx       # Tap-to-fullscreen image
│   │   │   ├── ContactSheet.tsx       # 2×3 grid display
│   │   │   ├── FrameStrip.tsx         # Horizontal scrolling frames
│   │   │   ├── VideoPlayer.tsx        # Inline + fullscreen video
│   │   │   └── DownloadButton.tsx     # Save to device
│   │   │
│   │   ├── checkpoints/
│   │   │   ├── CheckpointCard.tsx     # Generic checkpoint wrapper
│   │   │   ├── HeroReview.tsx         # Checkpoint 1: Hero image
│   │   │   ├── FramesReview.tsx       # Checkpoint 2: 6 frames
│   │   │   └── CheckpointActions.tsx  # Modify/Continue buttons
│   │   │
│   │   ├── progress/
│   │   │   ├── ProgressRing.tsx       # Circular SVG progress
│   │   │   ├── ProgressBar.tsx        # Linear progress bar
│   │   │   ├── VideoProgress.tsx      # Video generation status
│   │   │   └── StageIndicator.tsx     # Pipeline stage display
│   │   │
│   │   ├── controls/
│   │   │   ├── BottomSheet.tsx        # Slide-up modal
│   │   │   ├── PresetPicker.tsx       # Pose + Background tabs
│   │   │   ├── PresetCard.tsx         # Selectable preset item
│   │   │   └── PresetGrid.tsx         # Grid of preset cards
│   │   │
│   │   └── ui/
│   │       ├── Button.tsx             # Primary/Secondary/Ghost
│   │       ├── IconButton.tsx         # Circular icon button
│   │       ├── FilmGrain.tsx          # Noise texture overlay
│   │       ├── Divider.tsx            # Horizontal divider
│   │       └── Badge.tsx              # Status badges
│   │
│   ├── hooks/
│   │   ├── useSession.ts              # Session state management
│   │   ├── useSSE.ts                  # EventSource for streaming
│   │   ├── useCheckpoint.ts           # Checkpoint flow logic
│   │   ├── usePresets.ts              # Preset selection state
│   │   └── useMediaUpload.ts          # File upload handling
│   │
│   ├── api/
│   │   ├── client.ts                  # Base fetch wrapper
│   │   ├── sessions.ts                # Session API calls
│   │   └── types.ts                   # API response types
│   │
│   ├── stores/
│   │   └── appStore.ts                # Zustand store (if needed)
│   │
│   ├── styles/
│   │   ├── globals.css                # CSS variables, resets
│   │   ├── typography.css             # Font definitions
│   │   └── animations.css             # Keyframe animations
│   │
│   ├── types/
│   │   ├── index.ts                   # Shared types
│   │   ├── messages.ts                # Message types
│   │   └── checkpoints.ts             # Checkpoint types
│   │
│   ├── utils/
│   │   ├── formatters.ts              # Text/date formatting
│   │   └── cn.ts                      # Tailwind class merger
│   │
│   ├── App.tsx                        # Main app component
│   └── main.tsx                       # Entry point
│
├── public/
│   └── favicon.svg                    # App icon
│
├── index.html                         # HTML template
├── vite.config.ts                     # Vite configuration
├── tailwind.config.js                 # Tailwind theme
├── postcss.config.js                  # PostCSS config
├── tsconfig.json                      # TypeScript config
└── package.json                       # Dependencies
```

### Component Specifications

#### AppShell
```typescript
interface AppShellProps {
  children: React.ReactNode;
}
// Responsibilities:
// - Full viewport height (100dvh for mobile)
// - Safe area insets (env(safe-area-inset-*))
// - Film grain overlay
// - Flex column layout
```

#### Message
```typescript
interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  video?: string;
  timestamp?: Date;
  isStreaming?: boolean;
}
// Visual:
// - User: Right-aligned, gold accent border
// - Assistant: Left-aligned, subtle background
// - Images: Rounded corners, tap to expand
```

#### CheckpointCard
```typescript
interface CheckpointCardProps {
  stage: 'hero' | 'frames';
  status: 'complete' | 'reviewing' | 'modified';
  artifact?: string;
  message: string;
  onModify: () => void;
  onContinue: () => void;
}
// Visual:
// - Gold left border accent
// - Status icon (checkmark/spinner)
// - Two action buttons
```

#### BottomSheet
```typescript
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}
// Visual:
// - Slides up from bottom
// - Backdrop blur + dark overlay
// - Drag handle at top
// - Max height 85vh
```

#### PresetCard
```typescript
interface PresetCardProps {
  id: string;
  name: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}
// Visual:
// - Elevated surface background
// - Gold border when selected
// - Checkmark indicator
```

---

## Screen Designs

### Screen 1: Initial State (Empty)

```
┌─────────────────────────────────────┐
│                                     │
│  F A S H I O N   S H O O T     [≡]  │  ← Playfair, tracking-wider
│                                     │
├─────────────────────────────────────┤
│                                     │
│                                     │
│        ┌─────────────────┐          │
│        │  ┌───────────┐  │          │
│        │  │           │  │          │
│        │  │     ◇     │  │          │  ← Dashed gold border
│        │  │           │  │          │
│        │  │  Drop or  │  │          │
│        │  │   tap to  │  │          │
│        │  │  upload   │  │          │
│        │  │           │  │          │
│        │  └───────────┘  │          │
│        └─────────────────┘          │
│                                     │
│      Transform your vision into     │  ← text-secondary
│      editorial photography          │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [⚙️ Options]                       │  ← Ghost button
│                                     │
│  ┌───────────────────────────┬────┐ │
│  │ Describe your shoot...    │ ➤  │ │  ← Disabled state
│  └───────────────────────────┴────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Screen 2: Image Uploaded

```
┌─────────────────────────────────────┐
│  F A S H I O N   S H O O T     [≡]  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │     [Reference Image]       │    │  ← Uploaded image preview
│  │                             │    │
│  │                        [✕]  │    │  ← Remove button
│  └─────────────────────────────┘    │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [📎 Add More]  [⚙️ Options]        │
│                                     │
│  ┌───────────────────────────┬────┐ │
│  │ Confident energy, urban..  │ ➤  │ │  ← Enabled, gold send
│  └───────────────────────────┴────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Screen 3: Generating (Pre-Checkpoint)

```
┌─────────────────────────────────────┐
│  F A S H I O N   S H O O T     [≡]  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │     [Reference Image]       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  You                        │    │
│  │  Confident energy, urban    │    │
│  │  street style               │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ◐ Generating hero image... │    │  ← Typing indicator
│  │    ● ● ●                    │    │
│  └─────────────────────────────┘    │
│                                     │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────┬────┐ │
│  │                           │    │ │  ← Input disabled
│  └───────────────────────────┴────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Screen 4: Checkpoint 1 - Hero Review

```
┌─────────────────────────────────────┐
│  F A S H I O N   S H O O T     [≡]  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │                             │    │
│  │      [HERO IMAGE]           │    │  ← Full-width, 3:2 aspect
│  │                             │    │
│  │                             │    │
│  │                        [⤢]  │    │  ← Fullscreen button
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ┃ CHECKPOINT               │    │  ← Gold left border
│  │  ┃                          │    │
│  │  ┃ ✓ Hero image generated   │    │
│  │  ┃                          │    │
│  │  ┃ Review your hero shot.   │    │
│  │  ┃ Modify or continue to    │    │
│  │  ┃ generate the 6 frames.   │    │
│  │  ┃                          │    │
│  │  ┃ [Modify]  [Continue →]   │    │  ← Ghost + Gold buttons
│  │  ┃                          │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│  ┌───────────────────────────┬────┐ │
│  │ Adjust the hero...        │ ➤  │ │
│  └───────────────────────────┴────┘ │
└─────────────────────────────────────┘
```

### Screen 5: Checkpoint 2 - Frames Review

```
┌─────────────────────────────────────┐
│  F A S H I O N   S H O O T     [≡]  │
├─────────────────────────────────────┤
│                                     │
│  6 FRAMES READY                     │  ← Section header
│                                     │
│  ┌─────────┬─────────┬─────────┐    │
│  │         │         │         │    │
│  │    1    │    2    │    3    │    │  ← ContactSheet grid
│  │         │         │         │    │     Film sprocket edges
│  ├─────────┼─────────┼─────────┤    │
│  │         │         │         │    │
│  │    4    │    5    │    6    │    │
│  │         │         │         │    │
│  └─────────┴─────────┴─────────┘    │
│                                     │
│  Tap any frame to modify            │  ← text-muted hint
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ┃ CHECKPOINT               │    │
│  │  ┃                          │    │
│  │  ┃ ✓ All 6 frames ready     │    │
│  │  ┃                          │    │
│  │  ┃ [Continue to Video →]    │    │  ← Full-width gold
│  │  ┃                          │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│  ┌───────────────────────────┬────┐ │
│  │ Modify frame 3...         │ ➤  │ │
│  └───────────────────────────┴────┘ │
└─────────────────────────────────────┘
```

### Screen 6: Video Generation Progress

```
┌─────────────────────────────────────┐
│  F A S H I O N   S H O O T     [≡]  │
├─────────────────────────────────────┤
│                                     │
│                                     │
│            ┌─────────┐              │
│            │         │              │
│            │   67%   │              │  ← ProgressRing
│            │         │              │     Gold stroke + glow
│            └─────────┘              │
│                                     │
│       Generating video 4 of 6       │  ← text-primary
│                                     │
│  ━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░  │  ← Segmented progress
│                                     │
│  ┌────┬────┬────┬────┬────┬────┐    │
│  │ ✓  │ ✓  │ ✓  │ ◐  │ ○  │ ○  │    │  ← Video status strip
│  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │    │
│  └────┴────┴────┴────┴────┴────┘    │
│                                     │
│  Stitching will begin after all     │  ← text-muted
│  videos are complete                │
│                                     │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Generation in progress...          │  ← Disabled input area
│                                     │
└─────────────────────────────────────┘
```

### Screen 7: Final Video Complete

```
┌─────────────────────────────────────┐
│  F A S H I O N   S H O O T     [≡]  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │                             │    │
│  │          advancement ▶      │    │  ← Video player
│  │                             │    │
│  │                             │    │
│  │   advancement ───●───────── │    │  ← Playback controls
│  │  0:12 / 0:24               │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   ↓  Download Video         │    │  ← Primary gold button
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   ↻  Start New Shoot        │    │  ← Ghost button
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│  ┌───────────────────────────┬────┐ │
│  │ Start a new shoot...      │ ➤  │ │
│  └───────────────────────────┴────┘ │
└─────────────────────────────────────┘
```

### Screen 8: Options Bottom Sheet

```
┌─────────────────────────────────────┐
│  F A S H I O N   S H O O T     [≡]  │
├─────────────────────────────────────┤
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← Blurred backdrop
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
├─────────────────────────────────────┤
│              ───────                │  ← Drag handle
│                                     │
│  OPTIONS                       [✕]  │  ← Sheet title
│                                     │
│  ┌──────────────┬──────────────┐    │
│  │    POSE      │  BACKGROUND  │    │  ← Tab switcher
│  └──────────────┴──────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ┃ Confident Standing    ✓  │    │  ← Selected preset
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │    Seated Editorial         │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │    Leaning Casual           │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │    Editorial Drama          │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │       Apply Presets         │    │  ← Gold button
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

---

## Animation Specifications

### Global Timing Functions

```css
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-slower: 600ms;
}
```

### Page Load Animation

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: fadeInUp var(--duration-slow) var(--ease-out-expo) forwards;
}

/* Stagger children */
.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 50ms; }
.stagger-children > *:nth-child(3) { animation-delay: 100ms; }
/* ... */
```

### Hero Image Reveal (Checkpoint 1)

```css
@keyframes heroReveal {
  0% {
    clip-path: inset(100% 0 0 0);
    filter: brightness(1.5) contrast(0.8);
  }
  100% {
    clip-path: inset(0);
    filter: brightness(1) contrast(1);
  }
}

.hero-reveal {
  animation: heroReveal 800ms var(--ease-out-expo) forwards;
}
```

### Contact Sheet Frame Slide (Checkpoint 2)

```css
@keyframes frameSlide {
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

.contact-sheet .frame {
  animation: frameSlide 500ms var(--ease-out-expo) forwards;
}

.contact-sheet .frame:nth-child(1) { animation-delay: 0ms; }
.contact-sheet .frame:nth-child(2) { animation-delay: 80ms; }
.contact-sheet .frame:nth-child(3) { animation-delay: 160ms; }
.contact-sheet .frame:nth-child(4) { animation-delay: 240ms; }
.contact-sheet .frame:nth-child(5) { animation-delay: 320ms; }
.contact-sheet .frame:nth-child(6) { animation-delay: 400ms; }
```

### Bottom Sheet

```typescript
// Framer Motion config
const bottomSheetVariants = {
  hidden: {
    y: '100%',
    transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  },
  visible: {
    y: 0,
    transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  }
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};
```

### Progress Ring

```css
@keyframes progressGlow {
  0%, 100% {
    filter: drop-shadow(0 0 8px var(--accent-gold));
  }
  50% {
    filter: drop-shadow(0 0 16px var(--accent-amber));
  }
}

.progress-ring.active {
  animation: progressGlow 2s ease-in-out infinite;
}

.progress-ring circle.progress {
  transition: stroke-dashoffset 300ms var(--ease-out-expo);
}
```

### Film Grain Overlay

```css
@keyframes grain {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-5%, -10%); }
  20% { transform: translate(-15%, 5%); }
  30% { transform: translate(7%, -25%); }
  40% { transform: translate(-5%, 25%); }
  50% { transform: translate(-15%, 10%); }
  60% { transform: translate(15%, 0%); }
  70% { transform: translate(0%, 15%); }
  80% { transform: translate(3%, 35%); }
  90% { transform: translate(-10%, 10%); }
}

.film-grain {
  position: fixed;
  inset: -50%;
  width: 200%;
  height: 200%;
  background-image: url('/noise.png');
  opacity: 0.03;
  pointer-events: none;
  animation: grain 8s steps(10) infinite;
  z-index: 9999;
}
```

### Typing Indicator

```css
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}

.typing-dot {
  animation: typingBounce 1.2s ease-in-out infinite;
}

.typing-dot:nth-child(1) { animation-delay: 0ms; }
.typing-dot:nth-child(2) { animation-delay: 150ms; }
.typing-dot:nth-child(3) { animation-delay: 300ms; }
```

---

## Implementation Phases

### Phase 1: Foundation
**Goal:** Project scaffold with styling foundation

| Task | File(s) | Description |
|------|---------|-------------|
| 1.1 | `package.json` | Initialize Vite + React + TypeScript |
| 1.2 | `tailwind.config.js` | Configure custom theme (colors, fonts, spacing) |
| 1.3 | `src/styles/globals.css` | CSS variables, base resets |
| 1.4 | `src/styles/typography.css` | Font imports, type scale |
| 1.5 | `src/styles/animations.css` | Keyframe definitions |
| 1.6 | `index.html` | Google Fonts, meta tags |
| 1.7 | `src/components/ui/FilmGrain.tsx` | Noise overlay component |
| 1.8 | `src/components/layout/AppShell.tsx` | Main layout wrapper |
| 1.9 | `src/components/layout/Header.tsx` | Top bar component |
| 1.10 | `src/utils/cn.ts` | Tailwind class merger utility |

**Deliverable:** Empty app with proper styling, fonts, and layout structure.

---

### Phase 2: Chat Core
**Goal:** Working chat interface with message display

| Task | File(s) | Description |
|------|---------|-------------|
| 2.1 | `src/types/messages.ts` | Message type definitions |
| 2.2 | `src/components/chat/ChatView.tsx` | Scrollable container with auto-scroll |
| 2.3 | `src/components/chat/Message.tsx` | User/assistant message bubbles |
| 2.4 | `src/components/chat/MessageContent.tsx` | Text/image/video rendering |
| 2.5 | `src/components/chat/TypingIndicator.tsx` | Bouncing dots animation |
| 2.6 | `src/components/chat/ChatInput.tsx` | Text input with send button |
| 2.7 | `src/components/chat/ActionBar.tsx` | Upload + Options buttons |
| 2.8 | `src/components/ui/Button.tsx` | Primary/Secondary/Ghost variants |
| 2.9 | `src/components/ui/IconButton.tsx` | Circular icon button |

**Deliverable:** Static chat UI that displays hardcoded messages.

---

### Phase 3: Media Components
**Goal:** Image upload and display functionality

| Task | File(s) | Description |
|------|---------|-------------|
| 3.1 | `src/hooks/useMediaUpload.ts` | File handling, validation, preview |
| 3.2 | `src/components/media/ImageUpload.tsx` | Drag-drop zone + file picker |
| 3.3 | `src/components/media/ImagePreview.tsx` | Thumbnail with fullscreen modal |
| 3.4 | `src/components/media/ContactSheet.tsx` | 2×3 grid with film strip styling |
| 3.5 | `src/components/media/FrameStrip.tsx` | Horizontal scroll strip |
| 3.6 | `src/components/media/VideoPlayer.tsx` | Native video with custom controls |
| 3.7 | `src/components/media/DownloadButton.tsx` | Blob download handler |

**Deliverable:** Upload images, view them inline, tap to fullscreen.

---

### Phase 4: Checkpoints
**Goal:** Checkpoint review UI for hero and frames

| Task | File(s) | Description |
|------|---------|-------------|
| 4.1 | `src/types/checkpoints.ts` | Checkpoint type definitions |
| 4.2 | `src/components/checkpoints/CheckpointCard.tsx` | Generic wrapper with gold border |
| 4.3 | `src/components/checkpoints/CheckpointActions.tsx` | Modify/Continue buttons |
| 4.4 | `src/components/checkpoints/HeroReview.tsx` | Checkpoint 1 layout |
| 4.5 | `src/components/checkpoints/FramesReview.tsx` | Checkpoint 2 with grid |
| 4.6 | `src/hooks/useCheckpoint.ts` | Checkpoint state management |

**Deliverable:** Checkpoint cards with action buttons (not connected to API).

---

### Phase 5: Progress Indicators
**Goal:** Video generation progress UI

| Task | File(s) | Description |
|------|---------|-------------|
| 5.1 | `src/components/progress/ProgressRing.tsx` | SVG circular progress |
| 5.2 | `src/components/progress/ProgressBar.tsx` | Linear segmented bar |
| 5.3 | `src/components/progress/VideoProgress.tsx` | Combined progress view |
| 5.4 | `src/components/progress/StageIndicator.tsx` | 6-video status strip |

**Deliverable:** Progress UI displaying mock progress states.

---

### Phase 6: Controls
**Goal:** Bottom sheet with preset picker

| Task | File(s) | Description |
|------|---------|-------------|
| 6.1 | `src/components/controls/BottomSheet.tsx` | Animated slide-up sheet |
| 6.2 | `src/components/controls/PresetCard.tsx` | Selectable preset item |
| 6.3 | `src/components/controls/PresetGrid.tsx` | Grid layout for cards |
| 6.4 | `src/components/controls/PresetPicker.tsx` | Tabs + grid + apply button |
| 6.5 | `src/hooks/usePresets.ts` | Preset selection state |

**Deliverable:** Working preset picker in bottom sheet.

---

### Phase 7: API Integration
**Goal:** Connect frontend to backend

| Task | File(s) | Description |
|------|---------|-------------|
| 7.1 | `src/api/client.ts` | Base fetch wrapper with error handling |
| 7.2 | `src/api/types.ts` | API response types |
| 7.3 | `src/api/sessions.ts` | Session API functions |
| 7.4 | `src/hooks/useSession.ts` | Session state + React Query |
| 7.5 | `src/hooks/useSSE.ts` | EventSource hook for streaming |
| 7.6 | `vite.config.ts` | Proxy configuration for dev |

**Deliverable:** Frontend connected to backend, can start sessions.

---

### Phase 8: Flow Integration
**Goal:** Complete end-to-end flow

| Task | File(s) | Description |
|------|---------|-------------|
| 8.1 | `src/App.tsx` | Wire up all components |
| 8.2 | - | Image upload → session start |
| 8.3 | - | Checkpoint detection + UI switching |
| 8.4 | - | Progress updates via SSE |
| 8.5 | - | Final video display + download |
| 8.6 | - | New session reset |

**Deliverable:** Complete working flow from upload to download.

---

### Phase 9: Polish
**Goal:** Final refinements and deployment

| Task | File(s) | Description |
|------|---------|-------------|
| 9.1 | - | Animation timing refinements |
| 9.2 | - | Loading states and error handling |
| 9.3 | - | Mobile viewport testing (iOS Safari) |
| 9.4 | - | Accessibility pass (focus, ARIA) |
| 9.5 | - | Performance audit (bundle size) |
| 9.6 | `wrangler.toml` | Cloudflare Pages config |
| 9.7 | - | Deploy to Cloudflare Pages |

**Deliverable:** Production-ready deployed frontend.

---

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^5.4 | Build tool |
| `react` | ^18.3 | UI framework |
| `react-dom` | ^18.3 | React DOM renderer |
| `typescript` | ^5.6 | Type safety |
| `tailwindcss` | ^3.4 | Utility CSS |
| `postcss` | ^8.4 | CSS processing |
| `autoprefixer` | ^10.4 | CSS vendor prefixes |
| `framer-motion` | ^11.11 | Animations |
| `@tanstack/react-query` | ^5.59 | Server state |
| `clsx` | ^2.1 | Class name utility |
| `tailwind-merge` | ^2.5 | Tailwind class merging |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/react` | ^18.3 | React types |
| `@types/react-dom` | ^18.3 | React DOM types |
| `@vitejs/plugin-react` | ^4.3 | Vite React plugin |
| `eslint` | ^9.11 | Linting |
| `prettier` | ^3.3 | Formatting |
| `prettier-plugin-tailwindcss` | ^0.6 | Tailwind class sorting |

---

## Next Steps

1. **Run Phase 1** - Scaffold project with `npm create vite@latest frontend -- --template react-ts`
2. Install dependencies and configure Tailwind
3. Build components phase by phase
4. Test each phase before moving to next

---

## References

- [Session Summary](./SESSION_SUMMARY.md) - Previous session decisions
- [Architecture](./ARCHITECTURE.md) - Backend API reference
- [Vite Docs](https://vitejs.dev/)
- [Tailwind Docs](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
