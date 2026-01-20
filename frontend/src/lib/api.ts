import type {
  SessionStats,
  PipelineState,
  UploadResponse,
} from './types';

const API_BASE = '/api';

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new ApiError(response.status, error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// Health check
export async function checkHealth(): Promise<{
  status: string;
  agent: string;
  timestamp: string;
  config: { hasAnthropicKey: boolean; hasFalKey: boolean; port: number };
}> {
  const response = await fetch(`${API_BASE}/health`);
  return handleResponse(response);
}

// Sessions
export async function listSessions(): Promise<{
  success: boolean;
  count: number;
  sessions: SessionStats[];
}> {
  const response = await fetch(`${API_BASE}/sessions`);
  return handleResponse(response);
}

export async function getSession(sessionId: string): Promise<{
  success: boolean;
  session: SessionStats;
}> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}`);
  return handleResponse(response);
}

export async function getSessionPipeline(sessionId: string): Promise<{
  success: boolean;
  pipeline: PipelineState;
}> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/pipeline`);
  return handleResponse(response);
}

// Cancel active generation
export async function cancelGeneration(
  sessionId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse(response);
}

// Upload images
export async function uploadImages(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(response);
}

export { ApiError };
