import type { ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";
import { cx } from "./utils/cx.js";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: SelectOption[];
  placeholder?: string;
};

export function Select({
  className,
  label,
  hint,
  error,
  options,
  placeholder,
  id,
  disabled,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ds-field">
      {label ? (
        <label className="ds-label" htmlFor={selectId}>
          {label}
        </label>
      ) : null}
      <div className="ds-select-wrap">
        <select
          id={selectId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cx("ds-select", error ? "ds-select--invalid" : false, className)}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
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
