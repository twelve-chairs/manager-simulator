/** Something that can go inside an element; strings become text nodes, never markup. */
export type Child = Node | string | number | null | undefined | false | Child[];

/** Attribute values are set as text; functions become event listeners (`onClick` listens for `click`). */
export type Attrs = Record<string, string | number | boolean | undefined | ((event: Event) => void)>;

export function append(parent: Node, children: Child[]) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
}

/**
 * Builds an element. Attribute names come from the code; values, including content and names, are set with
 * `setAttribute` or as `value`, and children as text nodes, so no string is ever parsed as HTML.
 */
// @spec UI-TEXT-001
export function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false || name === 'value') continue;
    if (typeof value === 'function') el.addEventListener(name.slice(2).toLowerCase(), value);
    else el.setAttribute(name, value === true ? '' : String(value));
  }
  append(el, children);
  // Set after the children, so a select's value picks among the options it now has.
  if (attrs.value !== undefined && typeof attrs.value !== 'function') (el as HTMLInputElement).value = String(attrs.value);
  return el;
}
