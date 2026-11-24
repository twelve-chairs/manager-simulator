/// <reference types="node" />
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument, visit } from 'yaml';
import { validateBundle, type Situation } from '../src/situations';

export interface SourceFile {
  path: string;
  text: string;
}

export type CompileResult = { ok: true; bundle: Situation[] } | { ok: false; errors: { path: string; message: string }[] };

class Unreadable extends Error {}

/** Splits a situation file into its YAML front matter and Markdown body. */
function split(text: string): { frontMatter: string; body: string } {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  if (lines[0] !== '---') throw new Unreadable('must start with a front-matter block between --- lines');
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Unreadable('front matter is not closed with a --- line');
  return { frontMatter: lines.slice(1, end).join('\n'), body: lines.slice(end + 1).join('\n').trim() };
}

/** Parses YAML with the core schema only: no custom tags, no anchors or aliases, no duplicate keys. */
// @spec SIT-CONTENT-015
function parseFrontMatter(yaml: string): unknown {
  const doc = parseDocument(yaml, { schema: 'core', merge: false, uniqueKeys: true });
  const problem = doc.errors[0] ?? doc.warnings[0];
  if (problem) throw new Unreadable(`front matter: ${problem.message.split('\n')[0]}`);
  let unsupported: string | undefined;
  visit(doc, {
    Alias() {
      unsupported = 'aliases';
      return visit.BREAK;
    },
    Node(_, node) {
      if ('anchor' in node && node.anchor) unsupported = 'anchors';
      else if (node.tag) unsupported = `tags (${node.tag})`;
      return unsupported ? visit.BREAK : undefined;
    },
  });
  if (unsupported) throw new Unreadable(`front matter: ${unsupported} are not allowed`);
  return doc.toJS({ maxAliasCount: 0 });
}

/** Compiles situation files into one bundle, validated with the loader's validator. */
// @spec SIT-CONTENT-001, SIT-CONTENT-002
export function compileSituations(files: SourceFile[]): CompileResult {
  const errors: { path: string; message: string }[] = [];
  const parsed: { path: string; raw: unknown }[] = [];
  for (const file of files) {
    try {
      const { frontMatter, body } = split(file.text);
      const structure = parseFrontMatter(frontMatter);
      const isMap = structure !== null && typeof structure === 'object' && !Array.isArray(structure);
      if (isMap && Object.hasOwn(structure, 'text')) throw new Unreadable('text: the text goes in the body after the front matter, not in a text field');
      const raw = isMap ? { ...structure, text: body } : structure;
      parsed.push({ path: file.path, raw });
    } catch (e) {
      if (!(e instanceof Unreadable)) throw e;
      errors.push({ path: file.path, message: e.message });
    }
  }
  const results = validateBundle(parsed.map((p) => p.raw));
  results.forEach((r, i) => {
    if (!r.ok) errors.push({ path: parsed[i]!.path, message: r.error.message });
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, bundle: results.flatMap((r) => (r.ok ? [r.situation] : [])) };
}

/** Compiles every `.md` file in a directory, in name order, and writes the bundle only when all are valid. */
// @spec SIT-CONTENT-001, SIT-CONTENT-002
export function compileDirectory(dir: string, out: string): CompileResult {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => ({ path: join(dir, name), text: readFileSync(join(dir, name), 'utf8') }));
  const result = compileSituations(files);
  if (result.ok) writeFileSync(out, `${JSON.stringify(result.bundle, null, 2)}\n`);
  return result;
}
