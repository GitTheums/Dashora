import { cx } from "@dashora/ui";
import { DASHORA_WIDGET_DRAG_HANDLE_CLASS } from "../layout/drag-config.js";

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <circle cx="4" cy="3.5" r="1.1" fill="currentColor" />
      <circle cx="10" cy="3.5" r="1.1" fill="currentColor" />
      <circle cx="4" cy="7" r="1.1" fill="currentColor" />
      <circle cx="10" cy="7" r="1.1" fill="currentColor" />
      <circle cx="4" cy="10.5" r="1.1" fill="currentColor" />
      <circle cx="10" cy="10.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

export type WidgetDragHandleProps = {
  title: string;
  className?: string;
};

/**
 * Shared edit-mode grip used by every dashboard widget instance.
 * Must carry DASHORA_WIDGET_DRAG_HANDLE_CLASS so RGL can start a drag without
 * matching the generic button cancel selector.
 */
export function WidgetDragHandle({ title, className }: WidgetDragHandleProps) {
  return (
    <button
      type="button"
      className={cx(DASHORA_WIDGET_DRAG_HANDLE_CLASS, "widget-instance__drag-handle", className)}
      tabIndex={-1}
      aria-label={`Drag ${title}`}
      title="Drag to move"
    >
      <GripIcon />
    </button>
  );
}
