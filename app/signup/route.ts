import { POST as signup } from '@/app/api/auth/signup/route';
import { legacyOptions, withLegacyCors } from '@/lib/legacy';

export async function POST(request: Request) {
  const response = await signup(request);
  if (!response.ok) {
    const status = response.status === 409 ? 400 : response.status;
    return withLegacyCors(new Response(response.body, { status, headers: response.headers }));
  }
  return withLegacyCors(new Response(null, { status: 200 }));
}

export const OPTIONS = legacyOptions;
