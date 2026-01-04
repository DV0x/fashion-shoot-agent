import { useCallback } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ChatView } from './components/chat/ChatView';
import { ChatInput } from './components/chat/ChatInput';
import { useStreamingGenerate } from './hooks/useStreamingGenerate';

function App() {
  const {
    messages,
    isGenerating,
    activity,
    uploadedImages,
    awaitingInput,
    sendMessage,
    continueSession,
    resetSession,
    handleUpload,
    removeUploadedImage,
  } = useStreamingGenerate();

  // Handle continue with optional options (aspect ratio, speed, loop)
  const handleContinue = useCallback((options?: string) => {
    if (!options) {
      continueSession('continue');
      return;
    }

    // Check if it's an aspect ratio (contains ":")
    if (options.includes(':')) {
      continueSession(`Resize all frames to ${options} aspect ratio using resize-frames.ts, then continue with video generation.`);
      return;
    }

    // Check if it's a speed/loop option for clips checkpoint
    if (options.includes('x')) {
      const hasLoop = options.includes('loop');
      const speed = options.replace(' loop', '').replace('x', '');

      if (hasLoop) {
        continueSession(`Stitch the clips with ${speed}x speed and loop enabled.`);
      } else if (speed !== '1') {
        continueSession(`Stitch the clips with ${speed}x speed.`);
      } else {
        continueSession('continue');
      }
      return;
    }

    // Default: just continue
    continueSession('continue');
  }, [continueSession]);

  // Dynamic placeholder based on state
  const placeholder = awaitingInput
    ? 'Type to modify, or click Continue above...'
    : 'Describe your fashion shoot...';

  return (
    <AppShell onReset={messages.length > 0 ? resetSession : undefined}>
      <ChatView
        messages={messages}
        isGenerating={isGenerating}
        activity={activity}
        onContinue={handleContinue}
      />
      <ChatInput
        onSend={sendMessage}
        onUpload={handleUpload}
        uploadedImages={uploadedImages}
        onRemoveImage={removeUploadedImage}
        isGenerating={isGenerating}
        placeholder={placeholder}
      />
    </AppShell>
  );
}

export default App;
