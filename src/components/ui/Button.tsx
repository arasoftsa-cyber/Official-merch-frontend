import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({ className, children, ...rest }: ButtonProps) {
  return (
    <button className={`ui-button ${className ?? ''}`} {...rest}>
      {children}
    </button>
  );
}
