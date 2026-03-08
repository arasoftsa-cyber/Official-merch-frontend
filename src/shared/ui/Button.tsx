import React from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantStyles: Record<Variant, string> = {
  primary: 'bg-white text-slate-900 hover:translate-y-0.5 hover:shadow-xl',
  ghost: 'bg-transparent text-white hover:bg-white/10',
  danger: 'bg-red-500 text-white hover:bg-red-600',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'om-btn om-focus inline-flex items-center justify-center shadow-lg',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...rest}
    />
  );
}
