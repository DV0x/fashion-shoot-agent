import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ChatMessage,
  TextMessage,
  ThinkingMessage,
  ImageMessage,
  VideoMessage,
  SessionStats,
  PipelineState,
  Checkpoint,
  UploadedFile,
  PresetSelection,
  MessageRole,
  ContentBlock,
} from '../lib/types';
import { uploadImages } from '../lib/api';

// WebSocket message types from server
interface WSServerMessage {
  type: string;
  sessionId?: string;
  text?: string;
  messageType?: 'thinking' | 'response';
  subtype?: string;
  data?: unknown;
  checkpoint?: Checkpoint;
  progress?: unknown;
  awaitingInput?: boolean;
  sessionStats?: SessionStats;
  pipeline?: PipelineState;
  instrumentation?: unknown;
  response?: string;
  outputDir?: string;
  error?: string;
  timestamp?: string;
}

// WebSocket connection states
type WSConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketState {
  sessionId: string | null;
  messages: ChatMessage[];
  isGenerating: boolean;
  streamingText: string;
  streamingMessageId: string | null;
  error: string | null;
  stats: SessionStats | null;
  pipeline: PipelineState | null;
  checkpoint: Checkpoint | null;
  awaitingInput: boolean;
  uploadedImages: UploadedFile[];
  presets: PresetSelection;
  activity: string | null;
  connectionState: WSConnectionState;
  currentBlocks: Map<number, ContentBlock>;  // Phase 7: Block-level tracking
}

// Block accumulator for tracking streaming blocks
interface BlockAccumulator {
  blocks: Map<number, ContentBlock>;
  toolInputBuffers: Map<number, string>;
}

const initialState: WebSocketState = {
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
  connectionState: 'disconnected',
  currentBlocks: new Map(),
};

// Map tool names to user-friendly activity labels
function getActivityLabel(toolName: string): string {
  const labels: Record<string, string> = {
    Bash: 'Running command...',
    Read: 'Reading files...',
    Write: 'Writing files...',
    Glob: 'Searching files...',
    Grep: 'Searching content...',
    Skill: 'Loading skill...',
    Task: 'Processing...',
  };
  return labels[toolName] || 'Working...';
}

type AddTextMessage = { role: MessageRole; type: 'text'; content: string; isStreaming?: boolean };
type AddThinkingMessage = { role: MessageRole; type: 'thinking'; content: string };
type AddImageMessage = { role: MessageRole; type: 'image'; src: string; caption?: string };
type AddVideoMessage = { role: MessageRole; type: 'video'; src: string; poster?: string };
type AddMessageInput = AddTextMessage | AddThinkingMessage | AddImageMessage | AddVideoMessage;

/**
 * useWebSocket - WebSocket-based hook for real-time bidirectional communication
 *
 * Features:
 * - Automatic reconnection on disconnect
 * - Mid-generation cancellation
 * - YOLO mode activation
 * - Session subscription
 * - Backwards compatible with useStreamingGenerate
 */
export function useWebSocket() {
  const [state, setState] = useState<WebSocketState>(initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const accumulatedTextRef = useRef<string>('');
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isMountedRef = useRef(true); // Track if component is mounted

  // Phase 7: Block accumulator for tracking content blocks
  const blockAccumulatorRef = useRef<BlockAccumulator>({
    blocks: new Map(),
    toolInputBuffers: new Map(),
  });
  const updateThrottleRef = useRef<number | null>(null);

  // Build WebSocket URL based on current location
  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In development, backend runs on port 3002
    const host = window.location.hostname;
    const port = import.meta.env.DEV ? '3002' : window.location.port;
    return `${protocol}//${host}:${port}/ws`;
  }, []);

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

  // Phase 7: Block handling functions
  const handleBlockStart = useCallback((event: {
    blockIndex: number;
    blockType: string;
    toolName?: string;
    toolId?: string;
  }) => {
    const block: ContentBlock = {
      id: `block-${event.blockIndex}-${Date.now()}`,
      index: event.blockIndex,
      type: event.blockType as ContentBlock['type'],
      content: '',
      isStreaming: true,
      isComplete: false,
      toolName: event.toolName,
      toolId: event.toolId,
    };

    blockAccumulatorRef.current.blocks.set(event.blockIndex, block);

    if (event.blockType === 'tool_use') {
      blockAccumulatorRef.current.toolInputBuffers.set(event.blockIndex, '');
      if (event.toolName) {
        setActivity(getActivityLabel(event.toolName));
      }
    }

    if (updateThrottleRef.current === null) {
      updateThrottleRef.current = requestAnimationFrame(() => {
        setState((prev) => ({
          ...prev,
          currentBlocks: new Map(blockAccumulatorRef.current.blocks),
        }));
        updateThrottleRef.current = null;
      });
    }
  }, [setActivity]);

  const handleBlockDelta = useCallback((event: {
    blockIndex: number;
    text?: string;
    inputJsonDelta?: string;
  }) => {
    const block = blockAccumulatorRef.current.blocks.get(event.blockIndex);
    if (!block) return;

    if (event.text) {
      block.content += event.text;
    }

    if (event.inputJsonDelta) {
      const buffer = blockAccumulatorRef.current.toolInputBuffers.get(event.blockIndex) || '';
      blockAccumulatorRef.current.toolInputBuffers.set(event.blockIndex, buffer + event.inputJsonDelta);
    }

    // Throttle UI updates to 60fps with RAF batching
    if (updateThrottleRef.current === null) {
      updateThrottleRef.current = requestAnimationFrame(() => {
        // Build current text from all text/thinking blocks for real-time display
        const allTextContent = Array.from(blockAccumulatorRef.current.blocks.values())
          .filter(b => b.type === 'text' || b.type === 'thinking')
          .map(b => b.content)
          .join('\n');

        setState((prev) => {
          // Update both currentBlocks AND the streaming message content
          const currentId = streamingMessageIdRef.current;
          if (!currentId) {
            return { ...prev, currentBlocks: new Map(blockAccumulatorRef.current.blocks) };
          }

          const updatedMessages = prev.messages.map((msg) => {
            if (msg.id === currentId && (msg.type === 'text' || msg.type === 'thinking')) {
              return { ...msg, content: allTextContent };
            }
            return msg;
          });

          return {
            ...prev,
            messages: updatedMessages,
            streamingText: allTextContent,
            currentBlocks: new Map(blockAccumulatorRef.current.blocks),
          };
        });

        updateThrottleRef.current = null;
      });
    }
  }, []);

  const handleBlockEnd = useCallback((event: {
    blockIndex: number;
    toolInput?: Record<string, unknown>;
    toolDuration?: number;
  }) => {
    const block = blockAccumulatorRef.current.blocks.get(event.blockIndex);
    if (!block) return;

    block.isStreaming = false;
    block.isComplete = true;

    if (event.toolInput) {
      block.toolInput = event.toolInput;
    } else if (block.type === 'tool_use') {
      const buffer = blockAccumulatorRef.current.toolInputBuffers.get(event.blockIndex);
      if (buffer) {
        try {
          block.toolInput = JSON.parse(buffer);
        } catch (e) {
          // JSON parsing failed
        }
      }
    }

    if (event.toolDuration) {
      block.toolDuration = event.toolDuration;
    }

    blockAccumulatorRef.current.toolInputBuffers.delete(event.blockIndex);

    if (block.type === 'tool_use') {
      setActivity(null);
    }

    setState((prev) => ({
      ...prev,
      currentBlocks: new Map(blockAccumulatorRef.current.blocks),
    }));
  }, [setActivity]);

  // Convert accumulated blocks into a ChatMessage
  // Updates the existing streaming placeholder instead of creating new messages
  const finalizeBlocksToMessage = useCallback(() => {
    const blocks = blockAccumulatorRef.current.blocks;
    if (blocks.size === 0) return;

    const hasToolUse = Array.from(blocks.values()).some(b => b.type === 'tool_use');
    const textContent = Array.from(blocks.values())
      .filter(b => b.type === 'text' || b.type === 'thinking')
      .map(b => b.content)
      .join('\n');

    const currentStreamingId = streamingMessageIdRef.current;

    setState((prev) => {
      // If we have an existing streaming placeholder, update it
      if (currentStreamingId) {
        const updatedMessages = prev.messages.map((msg) => {
          if (msg.id === currentStreamingId) {
            if (hasToolUse) {
              // Convert to ThinkingMessage
              return {
                ...msg,
                type: 'thinking' as const,
                content: textContent,
                blocks: Array.from(blocks.values()),
                isStreaming: false,
              };
            } else {
              // Update as TextMessage
              return {
                ...msg,
                type: 'text' as const,
                content: textContent,
                isStreaming: false,
              };
            }
          }
          return msg;
        });
        return { ...prev, messages: updatedMessages, currentBlocks: new Map() };
      }

      // No existing placeholder - create new message (fallback)
      if (hasToolUse) {
        const thinkingMessage: ThinkingMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'thinking',
          content: textContent,
          blocks: Array.from(blocks.values()),
          timestamp: new Date(),
        };
        return { ...prev, messages: [...prev.messages, thinkingMessage], currentBlocks: new Map() };
      } else if (textContent.trim()) {
        const textMessage: TextMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          type: 'text',
          content: textContent,
          isStreaming: false,
          timestamp: new Date(),
        };
        return { ...prev, messages: [...prev.messages, textMessage], currentBlocks: new Map() };
      }

      return { ...prev, currentBlocks: new Map() };
    });

    // Reset block accumulator
    blockAccumulatorRef.current = {
      blocks: new Map(),
      toolInputBuffers: new Map(),
    };
  }, []);

  // Helper: Add image/video messages from checkpoint artifacts
  const addArtifactMessages = useCallback(
    (checkpoint: Checkpoint) => {
      const cacheBuster = `?t=${Date.now()}`;

      if (checkpoint.artifact) {
        const artifactPath = checkpoint.artifact;
        const isVideo = artifactPath.endsWith('.mp4');

        if (isVideo) {
          addMessage({
            role: 'assistant',
            type: 'video',
            src: `/${artifactPath}${cacheBuster}`,
          });
        } else {
          addMessage({
            role: 'assistant',
            type: 'image',
            src: `/${artifactPath}${cacheBuster}`,
            caption: checkpoint.stage === 'hero' ? 'Hero Image' : undefined,
          });
        }
      }

      if (checkpoint.artifacts && checkpoint.artifacts.length > 0) {
        checkpoint.artifacts.forEach((artifact, idx) => {
          const isVideo = artifact.endsWith('.mp4');

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
      }
    },
    [addMessage]
  );

  // Handle incoming WebSocket messages
  const handleWSMessage = useCallback(
    (data: WSServerMessage) => {
      switch (data.type) {
        case 'connected':
          setState((prev) => ({ ...prev, connectionState: 'connected' }));
          reconnectAttemptsRef.current = 0;
          break;

        case 'subscribed':
          console.log('[WS] Subscribed to session:', data.sessionId);
          break;

        case 'session_init':
          setState((prev) => ({
            ...prev,
            sessionId: data.sessionId || null,
          }));
          break;

        // Phase 7: Block-level events
        case 'block_start':
          handleBlockStart({
            blockIndex: (data as any).blockIndex as number,
            blockType: (data as any).blockType as string,
            toolName: (data as any).toolName as string | undefined,
            toolId: (data as any).toolId as string | undefined,
          });
          break;

        case 'block_delta':
          handleBlockDelta({
            blockIndex: (data as any).blockIndex as number,
            text: (data as any).text as string | undefined,
            inputJsonDelta: (data as any).inputJsonDelta as string | undefined,
          });
          // Phase 7: Block system handles accumulation, no legacy append needed
          break;

        case 'block_end':
          handleBlockEnd({
            blockIndex: (data as any).blockIndex as number,
            toolInput: (data as any).toolInput as Record<string, unknown> | undefined,
            toolDuration: (data as any).toolDuration as number | undefined,
          });
          break;

        case 'message_start':
          blockAccumulatorRef.current = {
            blocks: new Map(),
            toolInputBuffers: new Map(),
          };
          break;

        case 'message_stop':
          finalizeBlocksToMessage();
          break;

        case 'message_type_hint': {
          const hintType = data.messageType;
          if (hintType === 'thinking') {
            setState((prev) => {
              const updatedMessages = prev.messages.map((msg) => {
                if (msg.id === streamingMessageIdRef.current && msg.type === 'text') {
                  return { ...msg, type: 'thinking' as const };
                }
                return msg;
              });
              return { ...prev, messages: updatedMessages };
            });
          }
          break;
        }

        case 'text_delta':
          // Phase 7: Ignored - server sends both block_delta and text_delta for same content
          // Block system handles accumulation via block_delta events
          break;

        case 'assistant_message': {
          const newStreamingId = crypto.randomUUID();
          const newMessage: ChatMessage = {
            id: newStreamingId,
            role: 'assistant',
            type: 'text',
            content: '',
            isStreaming: true,
            timestamp: new Date(),
          };

          setState((prev) => {
            const updatedMessages = prev.messages.map((msg) => {
              if (msg.id === streamingMessageIdRef.current && msg.type === 'text') {
                return { ...msg, isStreaming: false };
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
          const subtype = data.subtype as string;
          const eventData = data.data as Record<string, unknown> | undefined;

          if (subtype === 'tool_call' || subtype === 'tool_use') {
            const toolName = (eventData?.tool_name as string) || (eventData?.name as string);
            if (toolName) {
              setActivity(getActivityLabel(toolName));
            }
          } else if (subtype === 'tool_result' || subtype === 'tool_response') {
            setActivity(null);
          }
          break;
        }

        case 'progress': {
          // Progress event from PostToolUse hooks - show artifacts only
          const progress = data.progress as Checkpoint;
          if (progress && (progress.artifact || progress.artifacts?.length)) {
            addArtifactMessages(progress);
          }
          break;
        }

        case 'checkpoint': {
          // Legacy checkpoint event - show artifacts only
          const checkpoint = data.checkpoint as Checkpoint;
          if (checkpoint) {
            addArtifactMessages(checkpoint);
          }
          break;
        }

        case 'complete': {
          const checkpoint = data.checkpoint as Checkpoint | undefined;

          setState((prev) => {
            const updatedMessages = prev.messages
              .map((msg) => {
                if (msg.id === streamingMessageIdRef.current && msg.type === 'text') {
                  return { ...msg, isStreaming: false };
                }
                return msg;
              })
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
              sessionId: data.sessionId || prev.sessionId,
              stats: (data.sessionStats as SessionStats) || null,
              pipeline: (data.pipeline as PipelineState) || null,
              checkpoint: checkpoint || null,
              awaitingInput: data.awaitingInput || false,
              uploadedImages: prev.sessionId ? prev.uploadedImages : [],
            };
          });

          streamingMessageIdRef.current = null;
          break;
        }

        case 'cancelled':
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            streamingMessageId: null,
            activity: null,
            error: null,
          }));
          streamingMessageIdRef.current = null;

          // Add system message about cancellation
          addMessage({
            role: 'system',
            type: 'text',
            content: 'Generation cancelled.',
          });
          break;

        case 'error':
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            streamingMessageId: null,
            activity: null,
            error: data.error || 'Unknown error',
          }));
          streamingMessageIdRef.current = null;
          break;

        case 'pong':
        case 'heartbeat':
          // Connection health, no action needed
          break;
      }
    },
    [appendToStreamingMessage, addMessage, addArtifactMessages, setActivity, handleBlockStart, handleBlockDelta, handleBlockEnd, finalizeBlocksToMessage]
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setState((prev) => ({ ...prev, connectionState: 'connecting' }));

    const wsUrl = getWsUrl();
    console.log('[WS] Connecting to:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setState((prev) => ({ ...prev, connectionState: 'connected', error: null }));
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSServerMessage;
        handleWSMessage(data);
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      setState((prev) => ({ ...prev, connectionState: 'error' }));
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setState((prev) => ({ ...prev, connectionState: 'disconnected' }));
      wsRef.current = null;

      // Only attempt reconnection if component is still mounted
      if (isMountedRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connect();
          }
        }, delay);
      }
    };
  }, [getWsUrl, handleWSMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback((permanent = false) => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Only prevent reconnection if this is a permanent disconnect (not StrictMode)
    if (permanent) {
      reconnectAttemptsRef.current = maxReconnectAttempts;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Send message via WebSocket
  const sendWS = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.error('[WS] Cannot send: not connected');
    return false;
  }, []);

  // Send chat message
  const sendMessage = useCallback(
    async (prompt: string) => {
      // Ensure connected
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        setState((prev) => ({ ...prev, error: 'WebSocket not connected' }));
        return;
      }

      // Add user message to UI
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

      // Send via WebSocket
      const inputImages = state.uploadedImages.map((f) => f.path);
      sendWS({
        type: 'chat',
        sessionId: state.sessionId,
        content: prompt,
        images: inputImages.length > 0 ? inputImages : undefined,
      });
    },
    [state.sessionId, state.uploadedImages, addMessage, sendWS]
  );

  // Continue session
  const continueSession = useCallback(
    async (customPrompt?: string) => {
      if (!state.sessionId || wsRef.current?.readyState !== WebSocket.OPEN) {
        return;
      }

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

      sendWS({
        type: 'continue',
        sessionId: state.sessionId,
        content: prompt,
      });
    },
    [state.sessionId, addMessage, sendWS]
  );

  const continueGeneration = useCallback(() => {
    continueSession('continue');
  }, [continueSession]);

  // Cancel active generation
  const cancelGeneration = useCallback(() => {
    if (!state.sessionId || !state.isGenerating) {
      return;
    }

    console.log('[WS] Cancelling generation for session:', state.sessionId);
    sendWS({
      type: 'cancel',
      sessionId: state.sessionId,
    });
  }, [state.sessionId, state.isGenerating, sendWS]);

  // Enable YOLO mode
  const enableYoloMode = useCallback(() => {
    if (!state.sessionId) {
      return;
    }

    sendWS({
      type: 'yolo',
      sessionId: state.sessionId,
    });
  }, [state.sessionId, sendWS]);

  // Subscribe to a session
  const subscribeToSession = useCallback(
    (sessionId: string) => {
      sendWS({
        type: 'subscribe',
        sessionId,
      });
    },
    [sendWS]
  );

  // Upload handlers
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

  const updatePresets = useCallback((presets: Partial<PresetSelection>) => {
    setState((prev) => ({
      ...prev,
      presets: { ...prev.presets, ...presets },
    }));
  }, []);

  // Reset session
  const resetSession = useCallback(() => {
    streamingMessageIdRef.current = null;
    accumulatedTextRef.current = '';
    setState((prev) => ({
      ...initialState,
      connectionState: prev.connectionState, // Keep connection state
    }));
  }, []);

  // Store latest connect/disconnect in refs to avoid dependency issues
  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  connectRef.current = connect;
  disconnectRef.current = disconnect;

  // Auto-connect on mount only (empty deps to prevent reconnect loops)
  useEffect(() => {
    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0; // Reset reconnect attempts on mount
    connectRef.current();
    return () => {
      isMountedRef.current = false;
      disconnectRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    // Actions
    sendMessage,
    continueGeneration,
    continueSession,
    cancelGeneration,
    enableYoloMode,
    subscribeToSession,
    resetSession,
    handleUpload,
    removeUploadedImage,
    updatePresets,
    // Connection management
    connect,
    disconnect,
    isConnected: state.connectionState === 'connected',
  };
}
