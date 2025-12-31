import React from 'react';

export const ProBadge = ({ className = '' }: { className?: string }) => (
  <span
    className={`font-baumans inline-flex items-center gap-1 rounded-lg shadow-sm !border-none !outline-0 ring-offset-1 !ring-offset-background/50 bg-gradient-to-br from-secondary/25 via-primary/20 to-accent/25 text-foreground px-2.5 pt-0.5 !pb-2 sm:pt-1 leading-3 dark:bg-gradient-to-br dark:from-primary dark:via-secondary dark:to-primary dark:text-foreground ${className}`}
  >
    <span>Fix</span>
  </span>
);
