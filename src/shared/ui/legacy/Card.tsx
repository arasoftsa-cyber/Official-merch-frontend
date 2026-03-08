import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export default function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className={`ui-card ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}
