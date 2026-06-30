// components/ui/Input.tsx — TOPE
import React, { useId } from 'react';
import '../../styles/components/input.css';
import '../../styles/components/select.css';

// ─── Input ───────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  required?: boolean;
}

export function Input({ label, error, icon, required, className = '', id, ...rest }: InputProps) {
  const reactId = useId();
  const inputId = id ?? reactId;
  return (
    <div className="input-wrapper">
      {label && (
        <label className={`input-label${required ? ' input-label-required' : ''}`} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className={icon ? 'input-with-icon' : undefined}>
        {icon && <span className="input-icon">{icon}</span>}
        <input
          id={inputId}
          className={`input-field${error ? ' input-field--error' : ''} ${className}`}
          {...rest}
        />
      </div>
      {error && <span className="input-error-msg" role="alert">{error}</span>}
    </div>
  );
}

// ─── Select ──────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export function Select({ label, error, required, options, placeholder, className = '', id, ...rest }: SelectProps) {
  const reactId = useId();
  const selectId = id ?? reactId;
  return (
    <div className="input-wrapper">
      {label && (
        <label className={`input-label${required ? ' input-label-required' : ''}`} htmlFor={selectId}>
          {label}
        </label>
      )}
      <select id={selectId} className={`select-field ${className}`} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      {error && <span className="input-error-msg" role="alert">{error}</span>}
    </div>
  );
}

// ─── Textarea ────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export function Textarea({ label, error, required, className = '', id, ...rest }: TextareaProps) {
  const reactId = useId();
  const textId = id ?? reactId;
  return (
    <div className="input-wrapper">
      {label && (
        <label className={`input-label${required ? ' input-label-required' : ''}`} htmlFor={textId}>
          {label}
        </label>
      )}
      <textarea id={textId} className={`textarea-field ${className}`} {...rest} />
      {error && <span className="input-error-msg" role="alert">{error}</span>}
    </div>
  );
}
