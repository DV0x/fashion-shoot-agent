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
    continueGeneration,
    resetSession,
    handleUpload,
    removeUploadedImage,
  } = useStreamingGenerate();

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
        onContinue={continueGeneration}
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
