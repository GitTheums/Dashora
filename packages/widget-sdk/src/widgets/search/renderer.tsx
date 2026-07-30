import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import type { WidgetRendererProps } from "../../registry/types.js";
import {
  WidgetFrame,
  WidgetStateBody,
  widgetInputStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import { type SearchConfig, type SearchData, buildSearchUrl } from "./config.js";
import { SEARCH_WIDGET_ID } from "./definition.js";
import { isEditableTarget, matchesKeyboardShortcut, parseKeyboardShortcut } from "./keyboard.js";

function SearchForm({ data }: { data: SearchData }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseKeyboardShortcut(data.keyboardShortcut);
    if (!parsed) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target === inputRef.current) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      if (!matchesKeyboardShortcut(event, parsed)) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [data.keyboardShortcut]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = buildSearchUrl(data.template, query);
    if (!url) {
      setError("Enter a search query.");
      return;
    }
    setError(null);
    if (data.openInNewTab) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(url);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <form
        onSubmit={onSubmit}
        aria-label={`${data.engineLabel} search`}
        style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
      >
        <label htmlFor={inputId} className="visually-hidden">
          Search with {data.engineLabel}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          style={{ ...widgetInputStyle, flex: "1 1 12rem", minWidth: "8rem" }}
          type="search"
          value={query}
          placeholder={data.placeholder}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => {
            setQuery(event.target.value);
            if (error) {
              setError(null);
            }
          }}
        />
        <button type="submit">Search</button>
      </form>
      {data.keyboardShortcut ? (
        <p style={widgetMutedStyle}>
          Shortcut: <kbd>{data.keyboardShortcut}</kbd> · {data.engineLabel}
        </p>
      ) : (
        <p style={widgetMutedStyle}>{data.engineLabel}</p>
      )}
      {error ? (
        <p role="alert" style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }}>
          {error}
        </p>
      ) : null}
      {data.quickLinks.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          {data.quickLinks.map((link) => (
            <li key={link.id}>
              <a
                href={link.url}
                {...(data.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "var(--ds-radius-md, 0.5rem)",
                  background: "var(--ds-primary-muted, rgba(15, 92, 76, 0.12))",
                  color: "var(--ds-primary, #0f5c4c)",
                  textDecoration: "none",
                  fontSize: "0.8125rem",
                }}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SearchRenderer({
  title,
  state,
  data,
  message,
  onRefresh,
}: WidgetRendererProps<SearchData, SearchConfig>) {
  return (
    <WidgetFrame title={title} widgetId={SEARCH_WIDGET_ID} state={state} onRefresh={onRefresh}>
      <WidgetStateBody state={state} message={message} onRefresh={onRefresh}>
        {data ? <SearchForm data={data} /> : null}
      </WidgetStateBody>
    </WidgetFrame>
  );
}
