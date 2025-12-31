'use client';

import { useState, useEffect } from 'react';

const PROFILE_ICONS: Record<string, string> = {
  'Arka': 'https://vucvdpamtrjkzmubwlts.supabase.co/storage/v1/object/public/users/user_2zMtrqo9RMaaIn4f8F2z3oeY497/avatar.png',
  'Abanalka': 'https://plus.unsplash.com/premium_photo-1739163838574-27c663e8a22b?auto=format&fit=crop&q=60&w=900',
  'SoluPaPa+': 'https://plus.unsplash.com/premium_photo-1739206781762-6b28bac44141?auto=format&fit=crop&q=60&w=900',
};

export function useSelectedProfileIcon(): string | null {
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hyper:selected-profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.icon) {
          setIcon(parsed.icon);
        } else if (parsed.label && PROFILE_ICONS[parsed.label]) {
          const mappedIcon = PROFILE_ICONS[parsed.label];
          setIcon(mappedIcon);
          localStorage.setItem('hyper:selected-profile', JSON.stringify({
            ...parsed,
            icon: mappedIcon
          }));
        }
      }
    } catch {}
  }, []);

  return icon;
}
