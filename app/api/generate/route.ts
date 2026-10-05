import { env } from 'cloudflare:workers';
import { bearerUser, jsonError } from '@/lib/server';

export async function POST(request: Request) {
  if (!(await bearerUser(request))) return jsonError('Please sign in again.', 401);
  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError('Please provide a prompt.', 400);
  }

  const prompt = body.prompt || '';
  if (!prompt) return jsonError('Please provide a prompt.', 400);

  if (!env.OPENAI_API_KEY) {
    return jsonError('Image generation is not configured.', 503);
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: '1024x1024' }),
  });

  if (!response.ok) {
    const requestId = response.headers.get('x-request-id');
    return jsonError(`Image generation failed${requestId ? ` (request ${requestId})` : ''}.`, 502);
  }

  const result = await response.json() as { data?: Array<{ b64_json?: string }> };
  const image = result.data?.[0]?.b64_json;
  if (!image) return jsonError('The image service returned no image.', 502);
  return Response.json({ image: `data:image/png;base64,${image}` });
}
