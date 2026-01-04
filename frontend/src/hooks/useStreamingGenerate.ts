import { useState, useCallback, useRef } from 'react';
import type {
  ChatMessage,
  TextMessage,
  ThinkingMessage,
  ImageMessage,
  CheckpointMessage,
  VideoMessage,
  SessionStats,
  PipelineState,
  Checkpoint,
  UploadedFile,
  PresetSelection,
  MessageRole,
} from '../lib/types';
import { uploadImages } from '../lib/api';

interface SessionState {
  sessionId: string | null;
  messages: ChatMessage[];
  isGenerating: boolean;
  streamingText: string;
  streamingMessageId: string | null; // ID of message currently being streamed
  error: string | null;
  stats: SessionStats | null;
  pipeline: PipelineState | null;
  checkpoint: Checkpoint | null;
  awaitingInput: boolean;
  uploadedImages: UploadedFile[];
  presets: PresetSelection;
  activity: string | null; // Current activity for thinking indicator
}

const initialState: SessionState = {
  sessionId: null,
  messages: [],
  isGenerating: false,
  streamingText: '',
  streamingMessageId: null,
  error: null,
  stats: null,
  pipeline: null,
  checkpoint: null,
  awaitingInput: false,
  uploadedImages: [],
  presets: {
    pose: 'confident-standing',
    background: 'studio-grey',
  },
  activity: null,
};

type AddTextMessage = { role: MessageRole; type: 'text'; content: string; isStreaming?: boolean };
type AddThinkingMessage = { role: MessageRole; type: 'thinking'; content: string };
type AddImageMessage = { role: MessageRole; type: 'image'; src: string; caption?: string };
type AddCheckpointMessage = { role: MessageRole; type: 'checkpoint'; checkpoint: Checkpoint };
type AddVideoMessage = { role: MessageRole; type: 'video'; src: string; poster?: string };
type AddMessageInput = AddTextMessage | AddThinkingMessage | AddImageMessage | AddCheckpointMessage | AddVideoMessage;

// Map tool names to user-friendly activity labels
function getActivityLabel(toolName: string): string {
  const labels: Record<string, string> = {
    'Bash': 'Running command...',
    'Read': 'Reading files...',
    'Write': 'Writing files...',
    'Glob': 'Searching files...',
    'Grep': 'Searching content...',
    'Skill': 'Loading skill...',
    'Task': 'Processing...',
  };
  return labels[toolName] || 'Working...';
}

export function useStreamingGenerate() {
  const [state, setState] = useState<SessionState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const accumulatedTextRef = useRef<string>('');

  const addMessage = useCallback((message: AddMessageInput): ChatMessage => {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    let fullMessage: ChatMessage;

    switch (message.type) {
      case 'text':
        fullMessage = { ...message, id, timestamp } as TextMessage;
        break;
      case 'thinking':
        fullMessage = { ...message, id, timestamp } as ThinkingMessage;
        break;
      case 'image':
        fullMessage = { ...message, id, timestamp } as ImageMessage;
        break;
      case 'checkpoint':
        fullMessage = { ...message, id, timestamp } as CheckpointMessage;
        break;
      case 'video':
        fullMessage = { ...message, id, timestamp } as VideoMessage;
        break;
    }

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, fullMessage],
    }));

    return fullMessage;
  }, []);

  const appendToStreamingMessage = useCallback((text: string) => {
    accumulatedTextRef.current += text;
    const currentText = accumulatedTextRef.current;

    setState((prev) => {
      if (streamingMessageIdRef.current) {
        const updatedMessages = prev.messages.map((msg) => {
          if (msg.id === streamingMessageIdRef.current) {
            // Works for both 'text' and 'thinking' message types
            if (msg.type === 'text' || msg.type === 'thinking') {
              return { ...msg, content: currentText };
            }
          }
          return msg;
        });
        return { ...prev, messages: updatedMessages, streamingText: currentText };
      }
      return { ...prev, streamingText: currentText };
    });
  }, []);

  const setActivity = useCallback((activity: string | null) => {
    setState((prev) => ({ ...prev, activity }));
  }, []);

  const updatePresets = useCallback((presets: Partial<PresetSelection>) => {
    setState((prev) => ({
      ...prev,
      presets: { ...prev.presets, ...presets },
    }));
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    try {
      const response = await uploadImages(files);
      setState((prev) => ({
        ...prev,
        uploadedImages: [...prev.uploadedImages, ...response.files],
      }));
      return response.files;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  const removeUploadedImage = useCallback((filename: string) => {
    setState((prev) => ({
      ...prev,
      uploadedImages: prev.uploadedImages.filter((f) => f.filename !== filename),
    }));
  }, []);

  // Helper: Add image/video messages from checkpoint artifacts
  const addArtifactMessages = useCallback((checkpoint: Checkpoint) => {
    console.log('[ARTIFACT DEBUG] addArtifactMessages called with:', JSON.stringify(checkpoint, null, 2));

    // Cache-busting timestamp to force browser to fetch updated images
    const cacheBuster = `?t=${Date.now()}`;

    // Single artifact (hero image or final video)
    if (checkpoint.artifact) {
      const artifactPath = checkpoint.artifact;
      const isVideo = artifactPath.endsWith('.mp4');
      console.log(`[ARTIFACT DEBUG] Single artifact: ${artifactPath}, isVideo: ${isVideo}`);

      if (isVideo) {
        console.log(`[ARTIFACT DEBUG] Adding VIDEO message: /${artifactPath}${cacheBuster}`);
        addMessage({
          role: 'assistant',
          type: 'video',
          src: `/${artifactPath}${cacheBuster}`,
        });
      } else {
        console.log(`[ARTIFACT DEBUG] Adding IMAGE message: /${artifactPath}${cacheBuster}`);
        addMessage({
          role: 'assistant',
          type: 'image',
          src: `/${artifactPath}${cacheBuster}`,
          caption: checkpoint.stage === 'hero' ? 'Hero Image' : undefined,
        });
      }
    } else {
      console.log('[ARTIFACT DEBUG] No single artifact');
    }

    // Multiple artifacts (frames or clips)
    if (checkpoint.artifacts && checkpoint.artifacts.length > 0) {
      console.log(`[ARTIFACT DEBUG] Multiple artifacts: ${checkpoint.artifacts.length} items`);
      checkpoint.artifacts.forEach((artifact, idx) => {
        const isVideo = artifact.endsWith('.mp4');
        console.log(`[ARTIFACT DEBUG] Artifact ${idx + 1}: ${artifact}, isVideo: ${isVideo}`);

        if (isVideo) {
          addMessage({
            role: 'assistant',
            type: 'video',
            src: `/${artifact}${cacheBuster}`,
          });
        } else {
          addMessage({
            role: 'assistant',
            type: 'image',
            src: `/${artifact}${cacheBuster}`,
            caption: `Frame ${idx + 1}`,
          });
        }
      });
    } else {
      console.log('[ARTIFACT DEBUG] No multiple artifacts');
    }
  }, [addMessage]);

  // Process SSE stream from response body
  const processSSEStream = useCallback(async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onEvent: (data: Record<string, unknown>) => void
  ) => {
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr.trim()) {
            try {
              const data = JSON.parse(jsonStr);
              onEvent(data);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    }
  }, []);

  const handleStreamEvent = useCallback((data: Record<string, unknown>) => {
    switch (data.type) {
      case 'session_init':
        setState((prev) => ({
          ...prev,
          sessionId: data.sessionId as string,
        }));
        break;

      case 'message_type_hint': {
        // Early hint that current message will be thinking (has tool_use)
        // Convert current streaming message to thinking type immediately
        const hintType = data.messageType as 'thinking' | 'response';
        if (hintType === 'thinking') {
          setState((prev) => {
            const updatedMessages = prev.messages.map((msg) => {
              if (msg.id === streamingMessageIdRef.current && msg.type === 'text') {
                // Convert to thinking message type
                return {
                  ...msg,
                  type: 'thinking' as const,
                };
              }
              return msg;
            });
            return { ...prev, messages: updatedMessages };
          });
        }
        break;
      }

      case 'text_delta':
        // Token-by-token streaming - goes to current message (text or thinking)
        appendToStreamingMessage(data.text as string);
        break;

      case 'assistant_message': {
        // Full message received - prepares for next message
        // Create a new streaming message for the next turn
        const newStreamingId = crypto.randomUUID();
        const newMessage: ChatMessage = {
          id: newStreamingId,
          role: 'assistant',
          type: 'text',  // Start as text, will be converted if hint comes
          content: '',
          isStreaming: true,
          timestamp: new Date(),
        };

        setState((prev) => {
          // Mark current message as done streaming
          const updatedMessages = prev.messages.map((msg) => {
            if (msg.id === streamingMessageIdRef.current) {
              if (msg.type === 'text') {
                return { ...msg, isStreaming: false };
              }
            }
            return msg;
          });

          return {
            ...prev,
            messages: [...updatedMessages, newMessage],
            streamingMessageId: newStreamingId,
          };
        });

        streamingMessageIdRef.current = newStreamingId;
        accumulatedTextRef.current = '';
        break;
      }

      case 'system': {
        // System events (tool calls, etc) - update activity indicator
        const subtype = data.subtype as string;
        const eventData = data.data as Record<string, unknown> | undefined;

        if (subtype === 'tool_call' || subtype === 'tool_use') {
          const toolName = eventData?.tool_name as string || eventData?.name as string;
          if (toolName) {
            setActivity(getActivityLabel(toolName));
          }
        } else if (subtype === 'tool_result' || subtype === 'tool_response') {
          setActivity(null);
        }
        break;
      }

      case 'checkpoint': {
        // Checkpoint detected via hook (sent immediately)
        const checkpoint = data.checkpoint as Checkpoint;
        console.log('[SSE DEBUG] Received checkpoint event:', JSON.stringify(checkpoint, null, 2));
        if (checkpoint) {
          console.log('[SSE DEBUG] Adding artifact messages for checkpoint:', checkpoint.stage);
          // Add artifact images/videos first
          addArtifactMessages(checkpoint);
          // Then add checkpoint message
          addMessage({
            role: 'system',
            type: 'checkpoint',
            checkpoint,
          });
        }
        break;
      }

      case 'complete': {
        // Generation complete
        const checkpoint = data.checkpoint as Checkpoint | undefined;

        console.log('[SSE DEBUG] Received complete event');
        console.log('[SSE DEBUG] Complete event checkpoint:', checkpoint ? JSON.stringify(checkpoint, null, 2) : 'null');
        console.log('[SSE DEBUG] Full complete event data:', JSON.stringify(data, null, 2));

        // Add artifact messages if checkpoint has artifacts
        if (checkpoint) {
          console.log('[SSE DEBUG] Adding artifact messages from complete event:', checkpoint.stage);
          console.log('[SSE DEBUG] Artifact:', checkpoint.artifact);
          console.log('[SSE DEBUG] Artifacts:', checkpoint.artifacts);
          addArtifactMessages(checkpoint);
          // Add checkpoint message
          addMessage({
            role: 'system',
            type: 'checkpoint',
            checkpoint,
          });
        } else {
          console.log('[SSE DEBUG] No checkpoint in complete event');
        }

        setState((prev) => {
          // Mark streaming message as no longer streaming, and remove if empty
          const updatedMessages = prev.messages
            .map((msg) => {
              if (msg.id === streamingMessageIdRef.current && msg.type === 'text') {
                return { ...msg, isStreaming: false };
              }
              return msg;
            })
            // Remove empty text messages (leftover from thinking conversion)
            .filter((msg) => {
              if (msg.type === 'text' && !msg.content.trim()) {
                return false;
              }
              return true;
            });

          return {
            ...prev,
            messages: updatedMessages,
            isGenerating: false,
            streamingMessageId: null,
            activity: null,
            sessionId: (data.sessionId as string) || prev.sessionId,
            stats: (data.sessionStats as SessionStats) || null,
            pipeline: (data.pipeline as PipelineState) || null,
            checkpoint: checkpoint || null,
            awaitingInput: (data.awaitingInput as boolean) || false,
            uploadedImages: prev.sessionId ? prev.uploadedImages : [],
          };
        });

        streamingMessageIdRef.current = null;
        break;
      }

      case 'error':
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          streamingMessageId: null,
          activity: null,
          error: data.error as string,
        }));
        streamingMessageIdRef.current = null;
        break;
    }
  }, [appendToStreamingMessage, addMessage, addArtifactMessages, setActivity]);

  const sendMessage = useCallback(
    async (prompt: string) => {
      // TEST COMMAND: Type "/test-video" to test video rendering without running pipeline
      if (prompt.trim() === '/test-video') {
        console.log('[TEST] Running video test...');
        addMessage({ role: 'user', type: 'text', content: prompt });

        // Create placeholder for streaming assistant message
        const assistantMessage = addMessage({
          role: 'assistant',
          type: 'text',
          content: '',
          isStreaming: true,
        });
        streamingMessageIdRef.current = assistantMessage.id;
        accumulatedTextRef.current = '';

        setState((prev) => ({
          ...prev,
          isGenerating: true,
          activity: 'Testing video...',
        }));

        try {
          const response = await fetch('/api/test/video-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const reader = response.body?.getReader();
          if (reader) {
            await processSSEStream(reader, handleStreamEvent);
          }
        } catch (error) {
          console.error('[TEST] Error:', error);
          setState((prev) => ({ ...prev, isGenerating: false, activity: null }));
        }
        return;
      }

      // TEST COMMAND: Type "/test-clips" to test clips checkpoint UI
      if (prompt.trim() === '/test-clips') {
        console.log('[TEST] Running clips checkpoint test...');
        addMessage({ role: 'user', type: 'text', content: prompt });

        // Create placeholder for streaming assistant message
        const assistantMessage = addMessage({
          role: 'assistant',
          type: 'text',
          content: '',
          isStreaming: true,
        });
        streamingMessageIdRef.current = assistantMessage.id;
        accumulatedTextRef.current = '';

        setState((prev) => ({
          ...prev,
          isGenerating: true,
          activity: 'Testing clips checkpoint...',
        }));

        try {
          const response = await fetch('/api/test/clips-checkpoint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const reader = response.body?.getReader();
          if (reader) {
            await processSSEStream(reader, handleStreamEvent);
          }
        } catch (error) {
          console.error('[TEST] Error:', error);
          setState((prev) => ({ ...prev, isGenerating: false, activity: null }));
        }
        return;
      }

      // Add user message
      addMessage({
        role: 'user',
        type: 'text',
        content: prompt,
      });

      // Create placeholder for streaming assistant message
      const assistantMessage = addMessage({
        role: 'assistant',
        type: 'text',
        content: '',
        isStreaming: true,
      });
      streamingMessageIdRef.current = assistantMessage.id;
      accumulatedTextRef.current = '';

      setState((prev) => ({
        ...prev,
        isGenerating: true,
        streamingText: '',
        streamingMessageId: assistantMessage.id,
        error: null,
        activity: 'Starting...',
      }));

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        // Build request body
        const inputImages = state.uploadedImages.map((f) => f.path);
        const body: Record<string, unknown> = { prompt };

        if (state.sessionId) {
          body.sessionId = state.sessionId;
        }
        if (inputImages.length > 0) {
          body.inputImages = inputImages;
        }

        // Use streaming endpoint
        const response = await fetch('/api/generate-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Read the SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        await processSSEStream(reader, handleStreamEvent);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // Request was cancelled
          return;
        }
        const message = error instanceof Error ? error.message : 'Generation failed';
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          activity: null,
          error: message,
        }));

        // Update streaming message to show error
        if (streamingMessageIdRef.current) {
          setState((prev) => {
            const updatedMessages = prev.messages.map((msg) => {
              if (msg.id === streamingMessageIdRef.current && msg.type === 'text') {
                return { ...msg, content: `Error: ${message}` };
              }
              return msg;
            });
            return { ...prev, messages: updatedMessages };
          });
        }
        streamingMessageIdRef.current = null;
      }
    },
    [state.sessionId, state.uploadedImages, addMessage, processSSEStream, handleStreamEvent]
  );

  // Continue session with streaming (same pattern as sendMessage)
  const continueSession = useCallback(
    async (customPrompt?: string) => {
      if (!state.sessionId) return;

      const prompt = customPrompt || 'continue';

      // Add user message
      addMessage({
        role: 'user',
        type: 'text',
        content: prompt,
      });

      // Create placeholder for streaming assistant message
      const assistantMessage = addMessage({
        role: 'assistant',
        type: 'text',
        content: '',
        isStreaming: true,
      });
      streamingMessageIdRef.current = assistantMessage.id;
      accumulatedTextRef.current = '';

      setState((prev) => ({
        ...prev,
        isGenerating: true,
        streamingText: '',
        streamingMessageId: assistantMessage.id,
        error: null,
        activity: 'Continuing...',
      }));

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        // Use streaming continue endpoint
        const response = await fetch(`/api/sessions/${state.sessionId}/continue-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Read the SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        await processSSEStream(reader, handleStreamEvent);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        const message = error instanceof Error ? error.message : 'Continue failed';
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          activity: null,
          error: message,
        }));

        if (streamingMessageIdRef.current) {
          setState((prev) => {
            const updatedMessages = prev.messages.map((msg) => {
              if (msg.id === streamingMessageIdRef.current && msg.type === 'text') {
                return { ...msg, content: `Error: ${message}` };
              }
              return msg;
            });
            return { ...prev, messages: updatedMessages };
          });
        }
        streamingMessageIdRef.current = null;
      }
    },
    [state.sessionId, addMessage, processSSEStream, handleStreamEvent]
  );

  const continueGeneration = useCallback(() => {
    continueSession('continue');
  }, [continueSession]);

  const resetSession = useCallback(() => {
    // Abort any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    streamingMessageIdRef.current = null;
    accumulatedTextRef.current = '';
    setState(initialState);
  }, []);

  return {
    ...state,
    sendMessage,
    continueGeneration,
    continueSession,
    resetSession,
    handleUpload,
    removeUploadedImage,
    updatePresets,
  };
}
