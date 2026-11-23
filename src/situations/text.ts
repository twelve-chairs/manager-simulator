import type { SimState } from '../sim';
import type { RoleKind } from './types';

/** A placeholder: `{role}` or `{role.property}`. Fixed pattern; never built from content. */
export const PLACEHOLDER = /\{([^{}]*)\}/g;

/** The properties a placeholder may name after the role. */
export const PLACEHOLDER_PROPERTIES: Partial<Record<RoleKind, readonly string[]>> = { person: ['team'] };

function nameOf(sim: SimState, kind: RoleKind, id: string): string | undefined {
  switch (kind) {
    case 'person':
      return sim.people[id]?.name;
    case 'team':
      return sim.teams[id]?.name;
    case 'project':
      return sim.projects[id]?.name;
  }
}

/**
 * Replaces placeholders with names in a single pass, so braces inside an inserted name stay as they are.
 * The result is plain text; names are inserted verbatim.
 */
// @spec SIT-TEXT-001, SIT-TEXT-002, SIT-TEXT-003
export function render(template: string, sim: SimState, bindings: Record<string, string>, kinds: Record<string, RoleKind>): string {
  return template.replace(PLACEHOLDER, (whole, inner: string) => {
    const [role, property, ...rest] = inner.split('.');
    if (rest.length > 0 || !role || !Object.hasOwn(bindings, role) || !Object.hasOwn(kinds, role)) return whole;
    const id = bindings[role]!;
    const kind = kinds[role]!;
    if (property === undefined) return nameOf(sim, kind, id) ?? whole;
    if (kind === 'person' && property === 'team') {
      const teamId = sim.people[id]?.teamId;
      return (teamId !== undefined && teamId !== null ? sim.teams[teamId]?.name : undefined) ?? whole;
    }
    return whole;
  });
}
