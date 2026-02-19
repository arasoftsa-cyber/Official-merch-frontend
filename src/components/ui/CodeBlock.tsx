import React from 'react';
import Card from './Card';

type CodeBlockProps = {
  data: any;
  title?: string;
};

export default function CodeBlock({ data, title }: CodeBlockProps) {
  return (
    <Card className="space-y-2 overflow-hidden bg-slate-900/50 p-4">
      {title && <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{title}</p>}
      <pre className="max-w-full overflow-x-auto text-xs text-slate-200">
        <code>{JSON.stringify(data, null, 2)}</code>
      </pre>
    </Card>
  );
}
