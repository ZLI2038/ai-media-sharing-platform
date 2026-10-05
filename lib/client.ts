export const TOKEN_KEY = 'socialai_token';
export const USER_KEY = 'socialai_username';

export type Post = {
  id: string;
  user: string;
  message: string;
  type: 'image' | 'video';
  url: string;
  createdAt: string;
};

export function token(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
}

export function authHeaders(): HeadersInit {
  const value = token();
  return value ? { Authorization: `Bearer ${value}` } : {};
}

export async function responseMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}
