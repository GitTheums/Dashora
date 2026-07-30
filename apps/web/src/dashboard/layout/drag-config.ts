/**
 * Canonical React Grid Layout drag-handle / cancel selectors for Dashora widgets.
 *
 * The handle is a <button>. Cancel must exclude it via :not(), otherwise every
 * grip pointerdown matches `button` and dragging never starts.
 */

export const DASHORA_WIDGET_DRAG_HANDLE_CLASS = "dashora-widget-drag-handle";

export const DASHORA_WIDGET_DRAG_HANDLE_SELECTOR = `.${DASHORA_WIDGET_DRAG_HANDLE_CLASS}`;

/**
 * Interactive targets that must not initiate a widget drag.
 * Keep the drag handle button excluded from the generic `button` rule.
 */
export const DASHORA_WIDGET_DRAG_CANCEL_SELECTOR = [
  "a",
  `button:not(${DASHORA_WIDGET_DRAG_HANDLE_SELECTOR})`,
  "input",
  "textarea",
  "select",
  "[data-grid-drag-cancel]",
  "[role='menu']",
  "[role='menuitem']",
].join(",");

/**
 * Mirrors DraggableCore’s ancestor walk: target matches, or a closest ancestor matches.
 */
export function elementMatchesSelector(element: Element, selector: string): boolean {
  if (element.matches(selector)) {
    return true;
  }
  return element.closest(selector) !== null;
}

export function elementMatchesDragHandle(element: Element): boolean {
  return elementMatchesSelector(element, DASHORA_WIDGET_DRAG_HANDLE_SELECTOR);
}

export function elementMatchesDragCancel(element: Element): boolean {
  return elementMatchesSelector(element, DASHORA_WIDGET_DRAG_CANCEL_SELECTOR);
}

/**
 * True when a pointer event on `element` should start a grid drag
 * (matches handle and does not match cancel).
 */
export function shouldStartWidgetDrag(element: Element): boolean {
  return elementMatchesDragHandle(element) && !elementMatchesDragCancel(element);
}
