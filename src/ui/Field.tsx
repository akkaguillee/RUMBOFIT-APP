import { AlertCircle, ChevronDown } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
  className?: string;
  hideLabel?: boolean;
}

export function FieldShell({ label, hint, error, id, children, className, hideLabel }: FieldShellProps) {
  return (
    <div className={cx('field', className)}>
      <label htmlFor={id} className={cx('field__label', hideLabel && 'sr-only')}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="field__error" id={`${id}-error`} role="alert">
          <AlertCircle aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  suffix?: ReactNode;
  size?: 'md' | 'lg';
  hideLabel?: boolean;
  fieldClassName?: string;
}

export function TextField({ label, hint, error, suffix, size = 'md', hideLabel, fieldClassName, id: idProp, className, ...rest }: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id} className={fieldClassName} hideLabel={hideLabel}>
      <div className={cx('input-wrap', size === 'lg' && 'input-wrap--lg')} data-invalid={error ? 'true' : undefined}>
        <input
          id={id}
          className={cx('input', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...rest}
        />
        {suffix && <span className="input__suffix">{suffix}</span>}
      </div>
    </FieldShell>
  );
}

/** Decimal input that accepts both "," and "." and keeps the raw text while typing. */
export function NumberField(props: Omit<TextFieldProps, 'type' | 'inputMode'> & { decimals?: boolean }) {
  const { decimals = true, ...rest } = props;
  return <TextField type="text" inputMode={decimals ? 'decimal' : 'numeric'} autoComplete="off" {...rest} />;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  options: { value: string; label: string }[];
  hideLabel?: boolean;
  fieldClassName?: string;
}

export function SelectField({ label, hint, error, options, id: idProp, hideLabel, fieldClassName, className, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id} hideLabel={hideLabel} className={fieldClassName}>
      <div className="input-wrap" data-invalid={error ? 'true' : undefined}>
        <select id={id} className={cx('input', className)} aria-invalid={error ? true : undefined} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="select-chevron" aria-hidden="true" />
      </div>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
}

export function TextAreaField({ label, hint, error, id: idProp, className, ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <div className="input-wrap" data-invalid={error ? 'true' : undefined}>
        <textarea id={id} className={cx('input', className)} aria-invalid={error ? true : undefined} {...rest} />
      </div>
    </FieldShell>
  );
}
