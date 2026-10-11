import { motion, type HTMLMotionProps } from 'motion/react';
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from './cx';
import { riseVariants } from './motion';
import { useSpecular } from './useSpecular';

type Variant = 'default' | 'strong' | 'glow';

interface BaseProps {
  variant?: Variant;
  sheen?: boolean;
  padded?: boolean | 'tight';
  className?: string;
  children?: ReactNode;
  /** Participates in the parent page cascade. */
  rise?: boolean;
}

const classes = (variant: Variant, interactive: boolean, padded: BaseProps['padded'], className?: string) =>
  cx(
    'glass',
    variant === 'strong' && 'glass--strong',
    variant === 'glow' && 'glass--glow',
    interactive && 'glass--interactive',
    padded === true && 'card',
    padded === 'tight' && 'card card--tight',
    className,
  );

type DivProps = BaseProps & Omit<HTMLMotionProps<'div'>, 'children' | 'className'>;

export const GlassCard = forwardRef<HTMLDivElement, DivProps>(function GlassCard(
  { variant = 'default', sheen, padded = true, className, children, rise = true, ...rest },
  ref,
) {
  const inner = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLDivElement);
  useSpecular(inner, variant !== 'default');
  return (
    <motion.div ref={inner} variants={rise ? riseVariants : undefined} className={classes(variant, false, padded, className)} {...rest}>
      {sheen && <span className="glass__sheen" aria-hidden="true" />}
      {children}
    </motion.div>
  );
});

type LinkCardProps = BaseProps & { to: string; 'aria-label'?: string; state?: unknown };

const MotionLink = motion.create(Link);

export function GlassLinkCard({ variant = 'default', sheen, padded = true, className, children, to, rise = true, ...rest }: LinkCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  useSpecular(ref);
  return (
    <MotionLink ref={ref} to={to} variants={rise ? riseVariants : undefined} className={classes(variant, true, padded, className)} {...rest}>
      {sheen && <span className="glass__sheen" aria-hidden="true" />}
      {children}
    </MotionLink>
  );
}

type ButtonCardProps = BaseProps & Omit<HTMLMotionProps<'button'>, 'children' | 'className'>;

export function GlassButtonCard({ variant = 'default', sheen, padded = true, className, children, rise = true, ...rest }: ButtonCardProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useSpecular(ref);
  return (
    <motion.button
      ref={ref}
      type="button"
      variants={rise ? riseVariants : undefined}
      className={classes(variant, true, padded, cx('text-left', className))}
      {...rest}
    >
      {sheen && <span className="glass__sheen" aria-hidden="true" />}
      {children}
    </motion.button>
  );
}
