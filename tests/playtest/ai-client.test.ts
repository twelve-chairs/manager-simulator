import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const constructed: unknown[] = [];
const parse = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  return {
    default: class {
      static APIError = APIError;
      beta = { messages: { parse } };
      constructor(options: unknown) {
        constructed.push(options);
      }
    },
  };
});

describe('the AI playtester’s client', () => {
  // @spec PLAY-AI-009
  it('retries a failed request up to six times', async () => {
    const { anthropicClient } = await import('../../playtest/ai/client');
    anthropicClient();
    expect(constructed.at(-1)).toEqual({ maxRetries: 6 });
  });

  // @spec PLAY-AI-009
  it('treats a reply it cannot parse as invalid, and lets an API error through', async () => {
    const { anthropicClient } = await import('../../playtest/ai/client');
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as { APIError: new (m: string) => Error };
    const client = anthropicClient();
    parse.mockRejectedValueOnce(new Error('Failed to parse structured output: SyntaxError: Unterminated string in JSON'));
    await expect(client.ask('sys', 'user', z.object({}), 'medium', 'm')).resolves.toBeNull();
    parse.mockRejectedValueOnce(new Anthropic.APIError('400 credit balance is too low'));
    await expect(client.ask('sys', 'user', z.object({}), 'medium', 'm')).rejects.toThrow('credit balance');
  });
});
