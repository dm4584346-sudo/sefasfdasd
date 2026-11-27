/**
 * Provider boundary for optional AI coaching.
 * The mobile app never stores a Gemini API key. A future Gemini integration
 * must run behind a developer-controlled HTTPS proxy which stores its secret
 * server-side, enforces quotas and returns a normalized coach response.
 */
export type CoachRequest = { question: string; context: string };
export type CoachResponse = { text: string; provider: 'local' | 'remote-proxy' };

export async function requestCoachHelp(input: CoachRequest): Promise<CoachResponse> {
  const endpoint = process.env.EXPO_PUBLIC_COACH_PROXY_URL;
  if (!endpoint) return { text: localCoachFallback(input), provider: 'local' };
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: input.question, context: input.context }),
    });
    if (!response.ok) throw new Error(`Coach proxy returned ${response.status}`);
    const payload = await response.json() as { text?: string };
    if (!payload.text) throw new Error('Coach proxy returned an empty response');
    return { text: payload.text, provider: 'remote-proxy' };
  } catch {
    return { text: localCoachFallback(input), provider: 'local' };
  }
}

function localCoachFallback(input: CoachRequest): string {
  return `Local coach review\n\nQuestion: ${input.question}\n\nStart with the win condition, then identify the most dangerous enemy response. Check vision, missing heroes, cooldowns, lane and objective timing. State what information would make you cancel your plan.\n\nContext considered: ${input.context || 'No extra context supplied.'}\n\nThis is a structured fallback prompt, not a claim that the app has generated a live AI analysis.`;
}
