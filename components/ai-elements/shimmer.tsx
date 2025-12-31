"use client";

import { TextShimmer } from '@/components/core/text-shimmer';
import { cn } from '@/lib/utils';
import type { ElementType } from 'react';

interface ShimmerProps {
  children: string;
  className?: string;
  duration?: number;
  as?: ElementType;
}

export function Shimmer({ children, className, duration = 2, as }: ShimmerProps) {
  return (
    <TextShimmer as={as} duration={duration} className={cn('inline-flex items-center', className)}>
      {children}
    </TextShimmer>
  );
}
