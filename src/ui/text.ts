/**
 * Emphasis: `*text*`, or `_text_` standing as its own word, with no space just inside the markers. Underscores inside
 * a word (deploy_job_runner) and doubled markers (**strong**) are not emphasis. Fixed pattern; never built from content.
 */
const EMPHASIS = /(?<!\*)\*(?![\s*])([^*\n]+?)(?<!\s)\*(?!\*)|(?<![\w_])_(?![\s_])([^_\n]+?)(?<!\s)_(?![\w_])/g;

/**
 * Situation text with Markdown emphasis shown as `em` elements. Text is set as text, so nothing else in the string
 * has any meaning; an unmatched marker shows as written.
 */
// @spec UI-TEXT-002
export function emphasis(text: string): Node[] {
  const nodes: Node[] = [];
  let last = 0;
  for (const match of text.matchAll(EMPHASIS)) {
    nodes.push(document.createTextNode(text.slice(last, match.index)));
    const em = document.createElement('em');
    em.textContent = match[1] ?? match[2]!;
    nodes.push(em);
    last = match.index + match[0].length;
  }
  nodes.push(document.createTextNode(text.slice(last)));
  return nodes.filter((n) => n.nodeType !== Node.TEXT_NODE || n.textContent !== '');
}
