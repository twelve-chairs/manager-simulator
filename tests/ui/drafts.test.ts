import { describe, expect, it } from 'vitest';
import { draftObject } from '../../src/ui/drafts';

describe('draft fields', () => {
  it('reads a saved object, and an empty one for anything else', () => {
    expect(draftObject<number>('{"g1":2}')).toEqual({ g1: 2 });
    for (const bad of [undefined, '', 'not json', '[1,2]', 'null', '3']) expect(draftObject(bad), String(bad)).toEqual({});
  });
});
