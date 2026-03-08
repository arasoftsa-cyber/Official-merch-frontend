import React from 'react';
import { cn } from './cn';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const inputBase = 'om-input w-full';

export default React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cn(inputBase, className)} {...rest} />;
});
