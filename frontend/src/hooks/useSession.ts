import { useState, useCallback } from 'react';
import type {
  ChatMessage,
  TextMessage,
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
import { generate, continueSession, uploadImages } from '../lib/api';

interface SessionState {
  sessionId: string | null;
  messages: ChatMessage[];
  isGenerating: boolean;
  error: string | null;
  stats: SessionStats | null;
  pipeline: PipelineState | null;
  checkpoint: Checkpoint | null;
  awaitingInput: boolean;
  uploadedImages: UploadedFile[];
  presets: PresetSelection;
}

const initialState: SessionState = {
  sessionId: null,
  messages: [],
  isGenerating: false,
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
};

type AddTextMessage = { role: MessageRole; type: 'text'; content: string };
type AddImageMessage = { role: MessageRole; type: 'image'; src: string; caption?: string };
type AddCheckpointMessage = { role: MessageRole; type: 'checkpoint'; checkpoint: Checkpoint };
type AddVideoMessage = { role: MessageRole; type: 'video'; src: string; poster?: string };
type AddMessageInput = AddTextMessage | AddImageMessage | AddCheckpointMessage | AddVideoMessage;

export function useSession() {
  const [state, setState] = useState<SessionState>(initialState);

  const addMessage = useCallback((message: AddMessageInput): ChatMessage => {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    let fullMessage: ChatMessage;

    switch (message.type) {
      case 'text':
        fullMessage = { ...message, id, timestamp } as TextMessage;
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

  const sendMessage = useCallback(
    async (prompt: string) => {
      // Add user message
      addMessage({
        role: 'user',
        type: 'text',
        content: prompt,
      });

      setState((prev) => ({
        ...prev,
        isGenerating: true,
        error: null,
      }));

      try {
        let response;

        if (state.sessionId && state.awaitingInput) {
          // Continue existing session
          response = await continueSession(state.sessionId, prompt);
        } else {
          // Start new generation
          const inputImages = state.uploadedImages.map((f) => f.path);
          response = await generate({
            prompt,
            sessionId: state.sessionId || undefined,
            inputImages: inputImages.length > 0 ? inputImages : undefined,
          });
        }

        // Add assistant response
        addMessage({
          role: 'assistant',
          type: 'text',
          content: response.response,
        });

        // Handle checkpoint
        if (response.checkpoint) {
          addMessage({
            role: 'system',
            type: 'checkpoint',
            checkpoint: response.checkpoint,
          });
        }

        // Handle pipeline assets
        if (response.pipeline?.assets) {
          const { hero, frames, finalVideo } = response.pipeline.assets;

          if (hero && !state.pipeline?.assets.hero) {
            addMessage({
              role: 'assistant',
              type: 'image',
              src: `/outputs/${hero.replace('outputs/', '')}`,
              caption: 'Hero Image',
            });
          }

          if (frames && frames.length > 0 && !state.pipeline?.assets.frames?.length) {
            frames.forEach((frame, i) => {
              addMessage({
                role: 'assistant',
                type: 'image',
                src: `/outputs/${frame.replace('outputs/', '')}`,
                caption: `Frame ${i + 1}`,
              });
            });
          }

          if (finalVideo && !state.pipeline?.assets.finalVideo) {
            addMessage({
              role: 'assistant',
              type: 'video',
              src: `/outputs/${finalVideo.replace('outputs/', '')}`,
            });
          }
        }

        setState((prev) => ({
          ...prev,
          sessionId: response.sessionId,
          isGenerating: false,
          stats: response.sessionStats,
          pipeline: response.pipeline,
          checkpoint: response.checkpoint || null,
          awaitingInput: response.awaitingInput || false,
          // Clear uploaded images after first generation
          uploadedImages: prev.sessionId ? prev.uploadedImages : [],
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed';
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          error: message,
        }));

        addMessage({
          role: 'system',
          type: 'text',
          content: `Error: ${message}`,
        });
      }
    },
    [state.sessionId, state.awaitingInput, state.uploadedImages, state.pipeline, addMessage]
  );

  const continueGeneration = useCallback(() => {
    sendMessage('continue');
  }, [sendMessage]);

  const resetSession = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    sendMessage,
    continueGeneration,
    resetSession,
    handleUpload,
    removeUploadedImage,
    updatePresets,
  };
}
