/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  DASHORA_WIDGET_DRAG_CANCEL_SELECTOR,
  DASHORA_WIDGET_DRAG_HANDLE_CLASS,
  DASHORA_WIDGET_DRAG_HANDLE_SELECTOR,
  elementMatchesDragCancel,
  elementMatchesDragHandle,
  shouldStartWidgetDrag,
} from "./drag-config.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("dashora widget drag config", () => {
  it("exports the canonical handle selector", () => {
    expect(DASHORA_WIDGET_DRAG_HANDLE_CLASS).toBe("dashora-widget-drag-handle");
    expect(DASHORA_WIDGET_DRAG_HANDLE_SELECTOR).toBe(".dashora-widget-drag-handle");
    expect(DASHORA_WIDGET_DRAG_CANCEL_SELECTOR).toContain(
      "button:not(.dashora-widget-drag-handle)",
    );
    expect(DASHORA_WIDGET_DRAG_CANCEL_SELECTOR).toContain("[data-grid-drag-cancel]");
    expect(DASHORA_WIDGET_DRAG_CANCEL_SELECTOR.split(",")).not.toContain("button");
  });

  it("allows drag from the handle button and nested SVG", () => {
    document.body.innerHTML = `
      <button type="button" class="${DASHORA_WIDGET_DRAG_HANDLE_CLASS}" aria-label="Drag Weather">
        <svg><circle /></svg>
      </button>
    `;
    const button = document.querySelector("button");
    const svg = document.querySelector("svg");
    const circle = document.querySelector("circle");
    expect(button).toBeTruthy();
    expect(svg).toBeTruthy();
    expect(circle).toBeTruthy();
    if (!button || !svg || !circle) {
      return;
    }

    expect(elementMatchesDragHandle(button)).toBe(true);
    expect(elementMatchesDragCancel(button)).toBe(false);
    expect(shouldStartWidgetDrag(button)).toBe(true);

    expect(elementMatchesDragHandle(svg)).toBe(true);
    expect(elementMatchesDragCancel(svg)).toBe(false);
    expect(shouldStartWidgetDrag(svg)).toBe(true);

    expect(elementMatchesDragHandle(circle)).toBe(true);
    expect(elementMatchesDragCancel(circle)).toBe(false);
    expect(shouldStartWidgetDrag(circle)).toBe(true);
  });

  it("cancels drag for refresh and action buttons", () => {
    document.body.innerHTML = `
      <div class="widget-instance__actions" data-grid-drag-cancel>
        <button type="button" aria-label="Refresh Weather">R</button>
        <button type="button" aria-label="Weather actions">…</button>
      </div>
    `;
    const refresh = document.querySelector('[aria-label="Refresh Weather"]');
    const actions = document.querySelector('[aria-label="Weather actions"]');
    expect(refresh).toBeTruthy();
    expect(actions).toBeTruthy();
    if (!refresh || !actions) {
      return;
    }
    expect(elementMatchesDragHandle(refresh)).toBe(false);
    expect(elementMatchesDragCancel(refresh)).toBe(true);
    expect(shouldStartWidgetDrag(refresh)).toBe(false);
    expect(elementMatchesDragCancel(actions)).toBe(true);
    expect(shouldStartWidgetDrag(actions)).toBe(false);
  });

  it("cancels drag for inputs and links", () => {
    document.body.innerHTML = `
      <div data-grid-drag-cancel>
        <input type="text" aria-label="Add a task" />
        <a href="https://example.test/post">Article</a>
      </div>
    `;
    const input = document.querySelector("input");
    const link = document.querySelector("a");
    expect(input).toBeTruthy();
    expect(link).toBeTruthy();
    if (!input || !link) {
      return;
    }
    expect(elementMatchesDragCancel(input)).toBe(true);
    expect(shouldStartWidgetDrag(input)).toBe(false);
    expect(elementMatchesDragCancel(link)).toBe(true);
    expect(shouldStartWidgetDrag(link)).toBe(false);
  });

  it("cancels drag for content marked data-grid-drag-cancel even without a button", () => {
    document.body.innerHTML = `<div class="widget-instance__body" data-grid-drag-cancel><p>Summary</p></div>`;
    const paragraph = document.querySelector("p");
    expect(paragraph).toBeTruthy();
    if (!paragraph) {
      return;
    }
    expect(elementMatchesDragCancel(paragraph)).toBe(true);
    expect(shouldStartWidgetDrag(paragraph)).toBe(false);
  });
});
