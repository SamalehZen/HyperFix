'use client';

import AuthCard from '@/components/auth-card';
import { useEffect } from 'react';
import { sileo } from 'sileo';

export default function SignInPage() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem('hyper:selected-profile');
      if (raw) {
        const data = JSON.parse(raw) as { label?: string } | null;
        if (data?.label) {
          sileo.success({ title: 'Profil sélectionné', description: data.label, duration: 3000 });
        } else {
          sileo.success({ title: 'Profil sélectionné', description: 'Votre profil est prêt', duration: 3000 });
        }
        localStorage.removeItem('hyper:selected-profile');
      }
    } catch {}
  }, []);

  return <AuthCard title="Bon retour" description="Connectez-vous pour continuer vers Hyper Fix" />;
}
