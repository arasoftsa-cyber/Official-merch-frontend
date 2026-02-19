import React from 'react';

type ContainerProps = React.HTMLAttributes<HTMLElement>;

export default function Container({ className, children, ...rest }: ContainerProps) {
  return (
    <section className={`ui-container ${className ?? ''}`} {...rest}>
      {children}
    </section>
  );
}
