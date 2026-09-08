import { getMemoryAccessToken, setMemoryAccessToken } from './tokenStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export interface ApiError {
  message: string;
  status?: number;
  code?: 'UNAUTHORIZED' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'NETWORK_ERROR';
}

let activeRefreshPromise: Promise<string | null> | null = null;

export async function sharedRefreshToken(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.accessToken) {
          const newToken = data.data.accessToken;
          setMemoryAccessToken(newToken);
          return newToken;
        }
      }
    } catch {
      // Refresh network error
    }

    setMemoryAccessToken(null);
    return null;
  })();

  try {
    return await activeRefreshPromise;
  } finally {
    activeRefreshPromise = null;
  }
}

async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const passedHeaders = (options.headers as Record<string, string>) || {};
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...passedHeaders,
  };

  if (isFormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }

  const existingAuthHeader = headers['Authorization'] || headers['authorization'];
  if (!existingAuthHeader) {
    const token = getMemoryAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      credentials: 'include',
      ...options,
      headers,
    });

    if (
      response.status === 401 &&
      !isRetry &&
      !endpoint.includes('/v1/auth/login') &&
      !endpoint.includes('/v1/auth/refresh')
    ) {
      const newToken = await sharedRefreshToken();
      if (newToken) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
        };

        return makeRequest<T>(endpoint, options, true);
      }
    }

    if (response.status === 401) {
      throw {
        message: 'Session expired. Please log in again.',
        status: 401,
        code: 'UNAUTHORIZED',
      } as ApiError;
    }

    if (response.status === 429) {
      throw {
        message: 'Too many requests. Please try again later.',
        status: 429,
        code: 'RATE_LIMIT',
      } as ApiError;
    }

    let json: Record<string, unknown> = {};
    if (response.status !== 204 && response.status !== 304) {
      const text = await response.text();
      if (text && text.trim().length > 0) {
        try {
          json = JSON.parse(text) as Record<string, unknown>;
        } catch {
          // Response text is non-JSON or empty
        }
      }
    }

    if (!response.ok || json.success === false) {
      throw {
        message: (json.message as string) || 'API request failed.',
        status: response.status,
        code: 'SERVER_ERROR',
      } as ApiError;
    }

    return json as T;
  } catch (err: unknown) {
    if ((err as ApiError).code) {
      throw err;
    }
    throw {
      message: 'Unable to connect to backend server.',
      code: 'NETWORK_ERROR',
    } as ApiError;
  }
}

export const apiClient = {
  get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return makeRequest<T>(endpoint, { method: 'GET', ...options });
  },

  post<T>(endpoint: string, data?: unknown, options: RequestInit = {}): Promise<T> {
    return makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  },

  postForm<T>(endpoint: string, formData: FormData, options: RequestInit = {}): Promise<T> {
    return makeRequest<T>(endpoint, {
      method: 'POST',
      body: formData,
      ...options,
    });
  },

  put<T>(endpoint: string, data?: unknown, options: RequestInit = {}): Promise<T> {
    return makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  },

  delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return makeRequest<T>(endpoint, { method: 'DELETE', ...options });
  },

  request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    return makeRequest<T>(endpoint, options, isRetry);
  },
};

