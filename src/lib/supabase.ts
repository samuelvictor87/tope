import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const AUTH_FETCH_TIMEOUT_MS = 8000;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are not defined in the environment variables.');
}

function timeoutResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'request_timeout',
      error_code: 'request_timeout',
      code: 'request_timeout',
      msg: 'O servidor demorou para responder.',
      message: 'O servidor demorou para responder.',
    }),
    {
      status: 408,
      statusText: 'Request Timeout',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Supabase-Api-Version': '2024-01-01',
      },
    }
  );
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeoutController = new AbortController();
  const parentSignal = init?.signal;

  const timer = setTimeout(() => {
    timeoutController.abort();
  }, AUTH_FETCH_TIMEOUT_MS);

  const onParentAbort = () => timeoutController.abort();
  parentSignal?.addEventListener('abort', onParentAbort);

  return fetch(input, { ...init, signal: timeoutController.signal })
    .catch((error: unknown) => {
      const timedOutByUs = timeoutController.signal.aborted && !parentSignal?.aborted;
      if (timedOutByUs) {
        return timeoutResponse();
      }
      throw error;
    })
    .finally(() => {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onParentAbort);
    });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
});
