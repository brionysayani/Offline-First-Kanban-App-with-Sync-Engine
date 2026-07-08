const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'offline-kanban-token';

type RequestOptions = {
  auth?: boolean;
};

const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

const request = async <T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> => {
  const token = getToken();
  const headers = new Headers(init.headers);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  const body = (await response.json().catch(() => undefined)) as T | { error?: string } | undefined;

  if (!response.ok) {
    const message = body && 'error' in body && body.error ? body.error : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return body as T;
};

export const apiClient = {
  getToken,
  setToken,
  clearToken,
  isAuthenticated: () => Boolean(getToken()),
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { method: 'GET' }, options);
  },
  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(
      path,
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined
      },
      options
    );
  }
};
