export type ParsedShortcut = {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

/** Parses shortcuts like `/`, `Ctrl+K`, `Meta+/`, `Alt+Shift+S`. */
export function parseKeyboardShortcut(raw: string): ParsedShortcut | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split("+").map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    return null;
  }
  let ctrl = false;
  let meta = false;
  let alt = false;
  let shift = false;
  let key: string | null = null;
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") {
      ctrl = true;
      continue;
    }
    if (lower === "meta" || lower === "cmd" || lower === "command") {
      meta = true;
      continue;
    }
    if (lower === "alt" || lower === "option") {
      alt = true;
      continue;
    }
    if (lower === "shift") {
      shift = true;
      continue;
    }
    if (key !== null) {
      return null;
    }
    key = part.length === 1 ? part.toLowerCase() : part.toLowerCase();
  }
  if (!key) {
    return null;
  }
  return { key, ctrl, meta, alt, shift };
}

export function matchesKeyboardShortcut(event: KeyboardEvent, shortcut: ParsedShortcut): boolean {
  if (event.ctrlKey !== shortcut.ctrl) {
    return false;
  }
  if (event.metaKey !== shortcut.meta) {
    return false;
  }
  if (event.altKey !== shortcut.alt) {
    return false;
  }
  if (event.shiftKey !== shortcut.shift) {
    return false;
  }
  const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
  return pressed === shortcut.key;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return target.isContentEditable;
}
