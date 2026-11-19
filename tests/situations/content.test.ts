/// <reference types="node" />
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileDirectory, compileSituations } from '../../scripts/compile-situations';
import { loadContent, type Situation } from '../../src/situations';
import { rejectionOf, sit, valid } from './fixtures';

const FILE = `---
id: quiet-1on1
title: Quiet in the 1:1
levels: [line-manager]
priority: normal
cooldownWeeks: 13
roles:
  - name: engineer
    kind: person
    where: { value: engineer.motivation, below: 40 }
choices:
  - id: ask
    label: Ask what would help
    outcomes:
      - id: opens-up
        when: { value: engineer.trust, atLeast: 50 }
        effects:
          - { type: value, target: engineer, field: motivation, amount: 10 }
        aftermath: "{engineer} opens up."
        debrief: Asking works with trust.
      - id: deflects
        effects: []
        aftermath: "{engineer} says it's fine."
        debrief: Without trust, a direct question gets a polite non-answer.
---

{engineer} answers every question with a word or two.
`;

describe('content compiler', () => {
  // @spec SIT-CONTENT-001
  it('compiles front matter and body into a situation', () => {
    const result = compileSituations([{ path: 'quiet-1on1.md', text: FILE }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle).toHaveLength(1);
    const s = result.bundle[0]!;
    expect(s.id).toBe('quiet-1on1');
    expect(s.cooldownWeeks).toBe(13);
    expect(s.choices[0]!.outcomes.map((o) => o.id)).toEqual(['opens-up', 'deflects']);
    expect(s.text).toBe('{engineer} answers every question with a word or two.');
  });

  // @spec SIT-CONTENT-001
  it('reads every situation file in a directory and writes one bundle', () => {
    const dir = mkdtempSync(join(tmpdir(), 'situations-'));
    mkdirSync(join(dir, 'in'));
    writeFileSync(join(dir, 'in', 'a.md'), FILE);
    writeFileSync(join(dir, 'in', 'b.md'), FILE.replace('id: quiet-1on1', 'id: quiet-again'));
    writeFileSync(join(dir, 'in', 'notes.txt'), 'not a situation');
    const out = join(dir, 'bundle.json');
    expect(compileDirectory(join(dir, 'in'), out).ok).toBe(true);
    const bundle = JSON.parse(readFileSync(out, 'utf8')) as Situation[];
    expect(bundle.map((s) => s.id)).toEqual(['quiet-1on1', 'quiet-again']);
  });

  // @spec SIT-CONTENT-002
  it('fails naming the file and field, and writes nothing, when a file is invalid', () => {
    const result = compileSituations([
      { path: 'good.md', text: FILE },
      { path: 'bad.md', text: FILE.replace('priority: normal', 'priority: sometimes') },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.path).toBe('bad.md');
    expect(result.errors[0]!.message).toMatch(/priority/);

    const dir = mkdtempSync(join(tmpdir(), 'situations-'));
    writeFileSync(join(dir, 'bad.md'), '# no front matter');
    const out = join(dir, 'bundle.json');
    expect(compileDirectory(dir, out).ok).toBe(false);
    expect(existsSync(out)).toBe(false);
  });

  // @spec SIT-CONTENT-001
  it('compiles the situations in content/situations', () => {
    const dir = mkdtempSync(join(tmpdir(), 'situations-'));
    const result = compileDirectory(join(import.meta.dirname, '../../content/situations'), join(dir, 'bundle.json'));
    if (!result.ok) throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
    expect(result.bundle.length).toBeGreaterThan(0);
  });

  // @spec SIT-CONTENT-002
  it('rejects a text field in the front matter', () => {
    const result = compileSituations([{ path: 'x.md', text: FILE.replace('cooldownWeeks: 13', 'cooldownWeeks: 13\ntext: Hidden') }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.message).toMatch(/text/);
  });

  // @spec SIT-CONTENT-015
  it('rejects YAML aliases and custom tags', () => {
    const alias = FILE.replace('cooldownWeeks: 13', 'cooldownWeeks: &weeks 13\nweight: *weeks');
    const tag = FILE.replace('cooldownWeeks: 13', 'cooldownWeeks: !!js/function "return 1"');
    for (const text of [alias, tag]) expect(compileSituations([{ path: 'x.md', text }]).ok).toBe(false);
  });
});

describe('loading and validation', () => {
  // @spec SIT-CONTENT-003
  it('returns valid situations and an error per invalid one', () => {
    const { situations, errors } = loadContent([sit({ id: 'a' }), { ...sit({ id: 'b' }), priority: 'whenever' }, sit({ id: 'c' })]);
    expect(situations.map((s) => s.id)).toEqual(['a', 'c']);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.situationId).toBe('b');
    expect(errors[0]!.message).toMatch(/priority/);
  });

  // @spec SIT-CONTENT-003
  it('uses the same validator in the compiler and the loader', () => {
    const bad = FILE.replace('field: motivation', 'field: happiness');
    const compiled = compileSituations([{ path: 'x.md', text: bad }]);
    expect(compiled.ok).toBe(false);
    const good = compileSituations([{ path: 'x.md', text: FILE }]);
    if (!good.ok) throw new Error('expected the fixture to compile');
    const broken = structuredClone(good.bundle);
    (broken[0]!.choices[0]!.outcomes[0]!.effects[0] as { field: string }).field = 'happiness';
    expect(loadContent(broken).errors).toHaveLength(1);
    if (!compiled.ok) expect(compiled.errors[0]!.message).toBe(loadContent(broken).errors[0]!.message);
  });

  // @spec SIT-CONTENT-004
  it('rejects missing fields, wrong types and undefined fields', () => {
    const { title: _title, ...noTitle } = sit();
    expect(rejectionOf(noTitle)).toMatch(/title/);
    expect(rejectionOf({ ...sit(), levels: 'line-manager' })).toMatch(/levels/);
    expect(rejectionOf({ ...sit(), mood: 'grim' })).toMatch(/mood/);
    expect(rejectionOf(JSON.parse(`{"__proto__": {"polluted": true}, ${JSON.stringify(sit()).slice(1)}`))).toMatch(/__proto__/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(rejectionOf({ ...sit(), roles: [{ name: 'engineer', kind: 'person', constructor: 'x' }] })).toMatch(/constructor/);
  });

  // @spec SIT-CONTENT-005
  it('rejects a duplicate id', () => {
    const { situations, errors } = loadContent([sit({ id: 'a' }), sit({ id: 'a' })]);
    expect(situations.map((s) => s.id)).toEqual(['a']);
    expect(errors[0]!.message).toMatch(/duplicate/i);
  });

  // @spec SIT-CONTENT-006
  it('rejects unknown condition forms, operators, subjects and properties', () => {
    const roleWhere = (where: unknown) => sit({ roles: [{ name: 'engineer', kind: 'person', where } as never] });
    expect(rejectionOf(roleWhere({ maybe: [] }))).toMatch(/maybe/);
    expect(rejectionOf(roleWhere({ value: 'engineer.motivation', around: 40 }))).toMatch(/around/);
    expect(rejectionOf(roleWhere({ value: 'boss.motivation', below: 40 }))).toMatch(/boss/);
    expect(rejectionOf(roleWhere({ value: 'engineer.happiness', below: 40 }))).toMatch(/happiness/);
    expect(rejectionOf(roleWhere({ value: 'engineer.headcount', below: 4 }))).toMatch(/headcount/);
  });

  // @spec SIT-CONTENT-007
  it('rejects references to roles from when, or to roles bound later', () => {
    expect(rejectionOf(sit({ when: { value: 'engineer.motivation', below: 40 } }))).toMatch(/engineer/);
    expect(
      rejectionOf(
        sit({
          roles: [
            { name: 'engineer', kind: 'person', where: { value: 'engineer.team', is: { value: 'lead.ledTeam' } } },
            { name: 'lead', kind: 'person' },
          ],
        }),
      ),
    ).toMatch(/lead/);
    valid(
      sit({
        roles: [
          { name: 'lead', kind: 'person' },
          { name: 'engineer', kind: 'person', where: { value: 'engineer.team', is: { value: 'lead.ledTeam' } } },
        ],
      }),
    );
  });

  // @spec SIT-CONTENT-008
  it('rejects placeholders naming unknown roles or properties', () => {
    expect(rejectionOf(sit({ text: '{boss} is here.' }))).toMatch(/boss/);
    expect(rejectionOf(sit({ text: '{engineer.mood} is low.' }))).toMatch(/mood/);
    const choices = sit().choices;
    expect(rejectionOf(sit({ choices: [{ ...choices[0]!, label: 'Call {lead}' }] }))).toMatch(/lead/);
  });

  // @spec SIT-CONTENT-009
  it('rejects malformed effects, hires, new projects and roles of the wrong kind', () => {
    const withEffect = (effect: unknown) => {
      const s = sit({ roles: [{ name: 'engineer', kind: 'person' }, { name: 'team', kind: 'team' }] });
      s.choices[0]!.outcomes[0]!.effects = [effect as never];
      return s;
    };
    expect(rejectionOf(withEffect({ type: 'value', target: 'engineer', field: 'motivation' }))).toMatch(/amount/);
    expect(rejectionOf(withEffect({ type: 'hire', teamId: 'team', person: {} }))).toMatch(/hire/);
    expect(rejectionOf(withEffect({ type: 'startProject', project: {} }))).toMatch(/startProject/);
    expect(rejectionOf(withEffect({ type: 'value', target: 'team', field: 'trust', amount: 5 }))).toMatch(/trust/);
    expect(rejectionOf(withEffect({ type: 'move', personId: 'team', teamId: 'engineer' }))).toMatch(/personId/);
    expect(rejectionOf(withEffect({ type: 'value', target: 'nobody', field: 'motivation', amount: 5 }))).toMatch(/nobody/);
    valid(withEffect({ type: 'move', personId: 'engineer', teamId: 'team' }));
    valid(withEffect({ type: 'rate', target: 'engineer', rating: 'meets' }));
    valid(withEffect({ type: 'value', target: 'player', field: 'reputation', amount: -3 }));
  });

  // @spec SIT-CONTENT-010
  it('requires choices, outcomes, and a final unconditional outcome', () => {
    const outcome = sit().choices[0]!.outcomes[0]!;
    const withOutcomes = (outcomes: unknown[]) => sit({ choices: [{ id: 'c', label: 'C', outcomes } as never] });
    expect(rejectionOf(sit({ choices: [] }))).toMatch(/choice/);
    expect(rejectionOf(withOutcomes([]))).toMatch(/outcome/);
    expect(rejectionOf(withOutcomes([{ ...outcome, when: { all: [] } }]))).toMatch(/last outcome/);
    expect(rejectionOf(withOutcomes([outcome, { ...outcome, id: 'other' }]))).toMatch(/when/);
    valid(withOutcomes([{ ...outcome, id: 'first', when: { all: [] } }, outcome]));
  });

  // @spec SIT-CONTENT-011
  it('returns an error without throwing for malformed bundles', () => {
    for (const input of ['not json', '{"a": 1}', 42, null, '[1, 2]']) {
      const result = loadContent(input);
      expect(result.situations).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
    }
    expect(loadContent(JSON.stringify([sit()])).situations).toHaveLength(1);
  });

  // @spec SIT-CONTENT-012
  it('never evaluates content as code', () => {
    const hostile = sit({
      id: 'hostile',
      text: '${globalThis.pwned = true} {engineer}',
      roles: [{ name: 'engineer', kind: 'person', where: { value: 'engineer.want', in: ['growth', 'constructor'] } } as never],
    });
    const { errors } = loadContent([hostile]);
    expect((globalThis as Record<string, unknown>).pwned).toBeUndefined();
    expect(errors).toHaveLength(1);
  });

  // @spec SIT-CONTENT-013
  it('rejects bad weights, cooldowns, literal types, in-lists, rating levels and history subjects', () => {
    const roleWhere = (where: unknown) => sit({ roles: [{ name: 'engineer', kind: 'person', where } as never] });
    expect(rejectionOf(sit({ weight: 0 }))).toMatch(/weight/);
    expect(rejectionOf(sit({ cooldownWeeks: -1 }))).toMatch(/cooldownWeeks/);
    expect(rejectionOf(roleWhere({ value: 'engineer.motivation', below: 'high' }))).toMatch(/motivation/);
    expect(rejectionOf(roleWhere({ value: 'engineer.want', is: 'money' }))).toMatch(/want/);
    expect(rejectionOf(roleWhere({ value: 'engineer.want', below: 'growth' }))).toMatch(/below/);
    expect(rejectionOf(roleWhere({ value: 'engineer.want', in: 'growth' }))).toMatch(/in/);
    expect(
      rejectionOf(sit({ roles: [{ name: 'team', kind: 'team', where: { value: 'team.ratings.great', above: 0 } }], text: 'x', choices: [{ id: 'c', label: 'c', outcomes: [{ id: 'o', effects: [], aftermath: '', debrief: '' }] }] })),
    ).toMatch(/great/);
    expect(
      rejectionOf(sit({ roles: [{ name: 'team', kind: 'team', where: { history: 'team', atLeast: 1 } }], text: 'x', choices: [{ id: 'c', label: 'c', outcomes: [{ id: 'o', effects: [], aftermath: '', debrief: '' }] }] })),
    ).toMatch(/history/);
    valid(roleWhere({ value: 'engineer.performance', below: { value: 'engineer.correspondingRating' } }));
    valid(roleWhere({ value: 'engineer.want', in: ['growth', 'autonomy'] }));
    valid(roleWhere({ history: 'engineer', action: 'line-manager.one-on-one', withinWeeks: 4, is: 0 }));
  });

  // @spec SIT-CONTENT-016
  it('rejects comparing an id-valued property with a literal', () => {
    const roleWhere = (where: unknown) => sit({ roles: [{ name: 'engineer', kind: 'person', where } as never] });
    for (const property of ['id', 'team', 'ledTeam']) {
      expect(rejectionOf(roleWhere({ value: `engineer.${property}`, is: 't1' }))).toMatch(property);
    }
    expect(rejectionOf(roleWhere({ value: 'engineer.team', in: ['t1'] }))).toMatch(/team/);
    valid(roleWhere({ value: 'engineer.team', isNot: { value: 'player.team' } }));
  });

  // @spec SIT-CONTENT-017
  it('allows a form only on team roles, and only detailed or aggregate', () => {
    const plainChoices = sit().choices.map((ch) => ({ ...ch, label: 'Talk', outcomes: ch.outcomes.map((o) => ({ ...o, effects: [], aftermath: '', debrief: '' })) }));
    const withRole = (role: unknown) => sit({ roles: [role as never], text: 'x', choices: plainChoices });
    expect(rejectionOf(withRole({ name: 'engineer', kind: 'person', form: 'aggregate' }))).toMatch(/form/);
    expect(rejectionOf(withRole({ name: 'team', kind: 'team', form: 'huge' }))).toMatch(/form/);
    valid(withRole({ name: 'team', kind: 'team', form: 'detailed' }));
  });

  // @spec SIT-CONTENT-018
  it('requires form aggregate for effects only aggregate teams accept', () => {
    const withTeam = (form: string | undefined, effect: unknown) =>
      sit({
        roles: [{ name: 'team', kind: 'team', ...(form && { form }) } as never],
        text: '{team}',
        choices: [{ id: 'c', label: 'C', outcomes: [{ id: 'o', effects: [effect as never], aftermath: '', debrief: '' }] }],
      });
    const reRate = { type: 'reRate', teamId: 'team', from: 'unrated', to: 'meets', count: 1 };
    const headcount = { type: 'value', target: 'team', field: 'headcount', amount: -1 };
    const attrition = { type: 'value', target: 'team', field: 'attritionRisk', amount: 5 };
    for (const effect of [reRate, headcount, attrition]) {
      expect(rejectionOf(withTeam(undefined, effect))).toMatch(/aggregate/);
      expect(rejectionOf(withTeam('detailed', effect))).toMatch(/aggregate/);
      valid(withTeam('aggregate', effect));
    }
    valid(withTeam(undefined, { type: 'value', target: 'team', field: 'stress', amount: 5 }));
  });

  // @spec SIT-CONTENT-019
  it('rejects duplicate choice ids, and duplicate outcome ids within a choice', () => {
    const choice = sit().choices[0]!;
    expect(rejectionOf(sit({ choices: [choice, { ...choice, label: 'Again' }] }))).toMatch(/talk/);
    const outcome = choice.outcomes[0]!;
    const twice = { ...choice, outcomes: [{ ...outcome, when: { all: [] } }, outcome] };
    expect(rejectionOf(sit({ choices: [twice as never] }))).toMatch(/fine/);
    const other = { ...choice, id: 'other' };
    valid(sit({ choices: [choice, other] }));
  });

  // @spec SIT-CONTENT-020, SIT-CONTENT-021
  it('rejects history actions combined with situations, or not in the catalogue', () => {
    const roleWhere = (where: unknown) => sit({ roles: [{ name: 'engineer', kind: 'person', where } as never] });
    expect(rejectionOf(roleWhere({ history: 'engineer', action: 'line-manager.one-on-one', situation: 'x', is: 0 }))).toMatch(/action/);
    expect(rejectionOf(roleWhere({ history: 'engineer', action: 'line-manager.one-on-one', choice: 'x', is: 0 }))).toMatch(/action/);
    expect(rejectionOf(roleWhere({ history: 'engineer', action: 'line-manager.one-on-ones', is: 0 }))).toMatch(/one-on-ones/);
    valid(roleWhere({ history: 'engineer', action: 'line-manager.delegate', withinWeeks: 8, atLeast: 2 }));
  });

  // @spec SIT-CONTENT-022
  it('reserves player, week, review and it as names roles cannot take', () => {
    for (const name of ['player', 'week', 'review', 'it']) {
      expect(rejectionOf(sit({ roles: [{ name, kind: 'person' }], text: 'x', choices: [{ id: 'c', label: 'c', outcomes: [{ id: 'o', effects: [], aftermath: '', debrief: '' }] }] }))).toMatch(name);
    }
    valid(sit({ when: { value: 'review.weeksAway', atMost: 2 } }));
  });

  // @spec SIT-CONTENT-023
  it('rejects conditions nested more than 32 levels deep, without throwing however deep', () => {
    const nested = (depth: number) => {
      let c: unknown = { value: 'player.stress', above: 1 };
      for (let i = 0; i < depth; i++) c = i % 2 ? { not: c } : { all: [c] };
      return c;
    };
    valid(sit({ when: nested(32) as never }));
    expect(rejectionOf(sit({ when: nested(33) as never }))).toMatch(/deep/);
    expect(() => loadContent([sit({ when: nested(50_000) as never })])).not.toThrow();
    expect(rejectionOf(sit({ when: nested(50_000) as never }))).toMatch(/deep/);
    const inCount = { count: { kind: 'person', where: nested(32) }, atLeast: 1 };
    expect(rejectionOf(sit({ when: inCount as never }))).toMatch(/deep/);
  });

  // @spec SIT-CONTENT-014
  it('rejects effects that rate the player', () => {
    const s = sit();
    s.choices[0]!.outcomes[0]!.effects = [{ type: 'rate', target: 'player', rating: 'meets' } as never];
    expect(rejectionOf(s)).toMatch(/player/);
  });
});
