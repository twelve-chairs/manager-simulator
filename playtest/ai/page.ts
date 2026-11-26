import type { Page } from '@playwright/test';
import type { Action, Screen } from './core';

/** What is on the page now: the screen and scene, and for a decision, the screen as the playtester reads it. */
export interface PageState {
  screen: string;
  scene: string;
  /** For a reaction, a recap or a review: its text, which the playtester reads before its next decision. */
  reading: string;
  decision: Screen | null;
  /** The header's turn word and number, such as "Week 3" or "Quarter 2". */
  turn: string;
}

/** Reads the page as text, the way a player sees it; the game's state is never read. */
// @spec PLAY-AI-002
export function readPage(page: Page): Promise<PageState> {
  return page.evaluate(() => {
    const q = (s: string, r: ParentNode = document) => r.querySelector<HTMLElement>(s);
    const qa = (s: string, r: ParentNode = document) => [...r.querySelectorAll<HTMLElement>(s)];
    const words = (el: HTMLElement | null) => (el?.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim();
    const screen = q('[data-screen]')?.dataset.screen ?? '';
    const sceneEl = q('[data-scene]');
    const scene = sceneEl?.dataset.scene ?? '';
    const turn = words(q('.week-number')).split(' · ')[0] ?? '';
    const headline = words(q('[data-part=heading]'));
    // What the player reads between decisions: a recap or a review whole, and a reaction's scene, where people answer
    // and bring up what happened before, without the panels around it or its Continue button.
    const reactionText = () => [...(sceneEl?.children ?? [])].filter((c) => c.tagName !== 'BUTTON').map((c) => words(c as HTMLElement)).filter(Boolean).join('\n');
    const reading = scene === 'recap' || screen === 'review' ? words(q('[data-screen]')) : scene === 'reaction' ? `After your choice:\n${reactionText()}` : '';
    // The habits a player can set: each control once, with its options.
    const seen = new Set<string>();
    const habits = qa('select[data-habit]').flatMap((s) => {
      const id = s.dataset.habit!;
      if (seen.has(id)) return [];
      seen.add(id);
      const select = s as unknown as HTMLSelectElement;
      return [{ id, label: (s.closest('label')?.querySelector('.habit-name')?.textContent ?? id).trim(), value: select.value, options: [...select.options].map((o) => ({ value: o.value, label: o.textContent ?? o.value })) }];
    });
    const panels = qa('[data-panel]')
      // The header already holds the goals; the habits are read as controls; How to play is read while it is open, as
      // a newcomer sees it in their first turns, and is otherwise only a closed heading.
      .filter((p) => !['days', 'save', 'habits', 'goals'].includes(p.dataset.panel ?? ''))
      .filter((p) => p.dataset.panel !== 'help' || (p as HTMLDetailsElement).open)
      .map((p) => words(p))
      .filter(Boolean);
    const text = [words(q('header.status')), ...panels, words(sceneEl ?? q('[data-screen]'))].filter(Boolean).join('\n\n');
    if (screen === 'handover') {
      const choices = qa('[data-handover]').map((b) => ({ id: b.dataset.handover!, label: words(b) }));
      return { screen, scene, reading, turn, decision: { kind: 'handover' as const, turn: 'Promotion', title: headline, text: words(q('[data-screen]')), choices, habits: [], canWait: false } };
    }
    if (screen !== 'week' || (scene !== 'moment' && scene !== 'before-monday')) return { screen, scene, reading, turn, decision: null };
    if (scene === 'before-monday') {
      return { screen, scene, reading, turn, decision: { kind: 'before-monday' as const, turn, title: headline, text, choices: [{ id: 'start', label: words(q('[data-action=start-week]')) || 'Start' }], habits, canWait: false } };
    }
    const choices = qa('[data-scene] [data-choice]').map((b) => ({ id: b.dataset.choice!, label: words(b) }));
    const headcount = q('[data-scene] [data-detail=headcount]');
    const bets = q('[data-scene] [data-detail=bets]');
    const calibration = qa('[data-scene] [data-calibration]');
    const firstPicker = bets ? (q('[data-offer] select', bets) as unknown as HTMLSelectElement | null) : null;
    return {
      screen,
      scene,
      reading,
      turn,
      decision: {
        kind: 'moment' as const,
        turn,
        title: headline,
        text,
        choices,
        habits,
        canWait: q('[data-action=wait]') !== null,
        ...(headcount && {
          placement: {
            heads: Number(q('[data-field=heads-given]', headcount)?.textContent ?? 0),
            targets: qa('[data-step-up]', headcount).map((b) => ({ id: b.dataset.stepUp!, label: (b.closest('li')?.querySelector('span')?.textContent ?? b.dataset.stepUp!).trim() })),
          },
        }),
        // Every move between neighbouring ratings, not only the buttons showing now: moving a head into a row gives
        // that row its own buttons, as a player sees after their first click.
        ...(calibration.length > 0 && {
          calibration: {
            moves: calibration.flatMap((table) => {
              const id = table.dataset.calibration!;
              const team = (q('h3', table)?.textContent ?? id).trim();
              const ratings = ['below', 'partial', 'meets', 'exceeds', 'outstanding'];
              return [{ id: `${id}:delivered`, label: `${team}: set to what it delivered` }, ...ratings.flatMap((r, i) => [
                ...(i > 0 ? [{ id: `${id}:${r}:${ratings[i - 1]}`, label: `${team}: ${r} down to ${ratings[i - 1]}` }] : []),
                ...(i < ratings.length - 1 ? [{ id: `${id}:${r}:${ratings[i + 1]}`, label: `${team}: ${r} up to ${ratings[i + 1]}` }] : []),
              ])];
            }),
          },
        }),
        ...(bets && {
          funding: {
            offers: qa('[data-offer]', bets).map((o) => ({ id: o.dataset.offer!, label: words(o).split('\n').filter((l) => !l.startsWith('Carried by')).join(' · ') })),
            groups: firstPicker ? [...firstPicker.options].filter((o) => o.value).map((o) => ({ id: o.value, label: o.textContent ?? o.value })) : [],
          },
        }),
      },
    };
  });
}

/** Sets habits, then takes an action on the page, as the playtester asked. */
export async function act(page: Page, screen: Screen, action: Action, habits: { habit: string; value: string }[]): Promise<void> {
  for (const h of habits) await page.locator(`select[data-habit="${h.habit}"]`).first().selectOption(h.value);
  switch (action.kind) {
    case 'choose':
      if (screen.kind === 'handover') await page.locator(`[data-handover="${action.choiceId}"]`).click();
      else if (screen.kind === 'before-monday') await page.locator('[data-action=start-week]').click();
      else await page.locator(`[data-scene] [data-choice="${action.choiceId}"]`).click();
      return;
    case 'wait':
      await page.locator('[data-action=wait]').click();
      return;
    case 'place':
      for (const [target, count] of Object.entries(action.place)) for (let i = 0; i < count; i++) await page.locator(`[data-step-up="${target}"]`).click();
      await page.locator('[data-action=place-heads]').click();
      return;
    case 'fund':
      for (const [offer, group] of Object.entries(action.fund)) await page.locator(`[data-offer="${offer}"] select`).selectOption(group);
      await page.locator('[data-action=fund-bets]').click();
      return;
    case 'calibrate':
      // Setting a team to what it delivered replaces its moves, so those go first; then each click moves one head, and a
      // move whose row has emptied disappears, so the clicks stop there.
      for (const move of Object.keys(action.calibrate).filter((m) => m.endsWith(':delivered'))) {
        await page.locator(`[data-set-delivered="${move.slice(0, -':delivered'.length)}"]`).click();
      }
      for (const [move, count] of Object.entries(action.calibrate)) {
        if (move.endsWith(':delivered')) continue;
        for (let i = 0; i < count; i++) {
          const button = page.locator(`[data-move="${move}"]`);
          if ((await button.count()) === 0) break;
          await button.first().click();
        }
      }
      await page.locator('[data-action=settle]').click();
      return;
  }
}

/** The clicks that are not decisions: moving past a reaction, finishing a turn, closing a recap, acknowledging a review. */
// @spec PLAY-AI-005
export async function moveOn(page: Page, state: PageState): Promise<boolean> {
  const press = async (selector: string) => {
    const el = page.locator(selector);
    if ((await el.count()) === 0) return false;
    await el.first().click();
    return true;
  };
  if (state.screen === 'review') return press('[data-action=acknowledge]');
  if (state.scene === 'reaction') return press('[data-action=continue]');
  if (state.scene === 'done') return press('[data-action=finish-week]');
  if (state.scene === 'recap') return press('[data-action=close-recap]');
  return false;
}
