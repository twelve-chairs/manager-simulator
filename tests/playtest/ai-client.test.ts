import { describe, expect, it, vi } from 'vitest';

const constructed: unknown[] = [];
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    beta = { messages: { parse: vi.fn() } };
    constructor(options: unknown) {
      constructed.push(options);
    }
  },
}));

describe('the AI playtester’s client', () => {
  // @spec PLAY-AI-009
  it('retries a failed request up to six times', async () => {
    const { anthropicClient } = await import('../../playtest/ai/client');
    anthropicClient();
    expect(constructed).toEqual([{ maxRetries: 6 }]);
  });
});
