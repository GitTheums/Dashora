import type { InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { cx } from "./utils/cx.js";

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label?: ReactNode;
};

export function Switch({
  className,
  label,
  id,
  disabled,
  checked,
  defaultChecked = false,
  onChange,
  ...rest
}: SwitchProps) {
  const [uncontrolled, setUncontrolled] = useState(Boolean(defaultChecked));
  const isControlled = checked !== undefined;
  const isChecked = isControlled ? Boolean(checked) : uncontrolled;

  return (
    <label className={cx("ds-switch", className)} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
        className="ds-switch__input"
        {...(isControlled ? { checked } : { defaultChecked })}
        onChange={(event) => {
          if (!isControlled) {
            setUncontrolled(event.target.checked);
          }
          onChange?.(event);
        }}
        {...rest}
      />
      <span className="ds-switch__track" aria-hidden="true">
        <span className="ds-switch__thumb" />
      </span>
      {label ? <span className="ds-switch__label">{label}</span> : null}
    </label>
  );
}
