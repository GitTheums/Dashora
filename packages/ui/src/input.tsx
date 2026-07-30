import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cx } from "./utils/cx.js";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  mono?: boolean;
};

export function Input({
  className,
  label,
  hint,
  error,
  mono = false,
  id,
  disabled,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ds-field">
      {label ? (
        <label className="ds-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cx(
          "ds-input",
          mono && "ds-input--mono",
          error ? "ds-input--invalid" : false,
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="ds-hint ds-hint--error" role="alert">
          {error}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={hintId} className="ds-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
