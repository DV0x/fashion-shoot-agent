import { AppShell } from './components/layout/AppShell';
import { ChatView } from './components/chat/ChatView';
import { ChatInput } from './components/chat/ChatInput';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const {
    messages,
    isGenerating,
    activity,
    uploadedImages,
    sendMessage,
    resetSession,
    handleUpload,
    removeUploadedImage,
    // Action Instance Pattern
    awaitingContinuation,
    executingActionId,
    executeAction,
    continueAction,
    continueSession,
  } = useWebSocket();

  return (
    <AppShell onReset={messages.length > 0 ? resetSession : undefined}>
      <ChatView
        messages={messages}
        isGenerating={isGenerating}
        activity={activity}
        awaitingContinuation={awaitingContinuation}
        executingActionId={executingActionId}
        onExecuteAction={executeAction}
        onContinueAction={continueAction}
        onContinue={() => continueSession()}
      />
      <ChatInput
        onSend={sendMessage}
        onUpload={handleUpload}
        uploadedImages={uploadedImages}
        onRemoveImage={removeUploadedImage}
        isGenerating={isGenerating}
        placeholder="Describe your fashion shoot..."
      />
    </AppShell>
  );
}

export default App;
