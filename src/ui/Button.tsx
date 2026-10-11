import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

interface Common {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

const btnClass = (variant: Variant, size: Size, block?: boolean, className?: string) =>
  cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className);

export const Button = forwardRef<HTMLButtonElement, Common & ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
  { variant = 'primary', size = 'md', block, icon, iconRight, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={btnClass(variant, size, block, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
});

export function ButtonLink({ variant = 'primary', size = 'md', block, icon, iconRight, className, children, ...rest }: Common & LinkProps) {
  return (
    <Link className={btnClass(variant, size, block, className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  tone?: 'default' | 'plain' | 'accent';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', tone = 'default', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx('icon-btn', size === 'sm' && 'icon-btn--sm', tone !== 'default' && `icon-btn--${tone}`, className)}
      {...rest}
    >
      {children}
    </button>
  );
});
