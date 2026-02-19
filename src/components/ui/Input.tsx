import React, { forwardRef } from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...rest }, ref) => {
  return <input ref={ref} className={`ui-input ${className ?? ''}`} {...rest} />;
});

Input.displayName = 'Input';

export default Input;
