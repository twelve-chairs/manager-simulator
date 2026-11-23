import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { AI_TUNING, type AiClient } from './core';

/** What a run's requests used, for the report. */
export interface Usage {
  requests: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

/**
 * The AI playtester's client: Claude Opus 5.5 with adaptive thinking, a structured reply validated against a Zod
 * schema, the system prompt cached across the run, and refusal fallbacks. A refused or unparseable reply is null.
 * Credentials come from the environment (an API key, a token or a signed-in profile), as the SDK resolves them.
 */
// @spec PLAY-AI-009
export function anthropicClient(): AiClient & { usage: Usage } {
  const client = new Anthropic();
  const usage: Usage = { requests: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  return {
    usage,
    async ask<T>(system: string, user: string, schema: z.ZodType<T>, effort: 'medium' | 'high'): Promise<T | null> {
      usage.requests += 1;
      const response = await client.beta.messages.parse({
        model: AI_TUNING.model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort, format: betaZodOutputFormat(schema) },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      });
      const u = response.usage;
      usage.tokens.input += u.input_tokens;
      usage.tokens.output += u.output_tokens;
      usage.tokens.cacheRead += u.cache_read_input_tokens ?? 0;
      usage.tokens.cacheWrite += u.cache_creation_input_tokens ?? 0;
      // A whole chain that declined, or a reply cut off, is treated as an invalid reply.
      if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
      return response.parsed_output ?? null;
    },
  };
}
