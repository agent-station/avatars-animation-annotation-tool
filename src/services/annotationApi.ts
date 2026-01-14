import type { Annotation } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const USER_ID = import.meta.env.VITE_USER_ID || 'default';

// Check if API is configured
export function isApiConfigured(): boolean {
  return !!API_BASE_URL;
}

// Get user ID (could be extended to support auth)
export function getUserId(): string {
  return USER_ID;
}

// API response types
interface GetAllResponse {
  annotations: Record<string, Annotation>;
}

interface MutationResponse {
  success: boolean;
  count?: number;
}

// Error handling
class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }
  return response.json();
}

// API functions
export async function fetchAllAnnotations(): Promise<Record<string, Annotation>> {
  const response = await fetch(`${API_BASE_URL}/annotations/${USER_ID}`);
  const data = await handleResponse<GetAllResponse>(response);
  return data.annotations;
}

// Fetch only annotations updated since a given timestamp (for incremental sync)
export async function fetchAnnotationsSince(
  since: string
): Promise<Record<string, Annotation>> {
  const url = `${API_BASE_URL}/annotations/${USER_ID}?updatedSince=${encodeURIComponent(since)}`;
  const response = await fetch(url);
  const data = await handleResponse<GetAllResponse>(response);
  return data.annotations;
}

export async function fetchAnnotation(animationPath: string): Promise<Annotation | null> {
  const encodedPath = encodeURIComponent(animationPath);
  const response = await fetch(`${API_BASE_URL}/annotations/${USER_ID}/${encodedPath}`);

  if (response.status === 404) {
    return null;
  }

  return handleResponse<Annotation>(response);
}

export async function saveAnnotation(animationPath: string, annotation: Annotation): Promise<void> {
  const encodedPath = encodeURIComponent(animationPath);
  const response = await fetch(`${API_BASE_URL}/annotations/${USER_ID}/${encodedPath}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(annotation),
  });

  await handleResponse<MutationResponse>(response);
}

export async function deleteAnnotation(animationPath: string): Promise<void> {
  const encodedPath = encodeURIComponent(animationPath);
  const response = await fetch(`${API_BASE_URL}/annotations/${USER_ID}/${encodedPath}`, {
    method: 'DELETE',
  });

  await handleResponse<MutationResponse>(response);
}

export async function batchImportAnnotations(
  annotations: Record<string, Annotation>
): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/annotations/batch/${USER_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ annotations }),
  });

  const data = await handleResponse<MutationResponse>(response);
  return data.count || Object.keys(annotations).length;
}
