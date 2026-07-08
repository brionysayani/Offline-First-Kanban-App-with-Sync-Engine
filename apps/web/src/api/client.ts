export const apiClient = {
  async get<T>(path: string): Promise<T> {
    return fetch(path).then((res) => res.json()) as Promise<T>;
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then((res) => res.json()) as Promise<T>;
  }
};
