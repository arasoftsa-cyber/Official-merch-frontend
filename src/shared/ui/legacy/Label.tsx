import React from 'react';

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export default function Label({ className, children, ...rest }: LabelProps) {
  return (
    <label className={`ui-label ${className ?? ''}`} {...rest}>
      {children}
    </label>
  );
}
