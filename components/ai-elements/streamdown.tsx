"use client";

import Marked from 'marked-react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface StreamdownProps extends HTMLAttributes<HTMLDivElement> {
  children: string;
}

export function Streamdown({ children, className, ...props }: StreamdownProps) {
  return (
    <div className={cn('prose prose-sm max-w-none text-muted-foreground', className)} {...props}>
      <Marked value={children} />
    </div>
  );
}
