'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/contexts/user-context';
import {
  UsageSection,
  PreferencesSection,
} from '@/components/settings-dialog';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Analytics01Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Suspense, useState, useEffect, useRef } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { signOut } from '@/lib/auth-client';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeftIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UploadIcon } from '@phosphor-icons/react';
import { Spinner } from '@/components/ui/spinner';

function SettingsPageInner() {
  const router = useRouter();
  const { user, isProUser, isLoading } = useUser();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'usage';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [blurPersonalInfo, setBlurPersonalInfo] = useLocalStorage<boolean>('scira-blur-personal-info', false);
  const [selectedProfileIcon, setSelectedProfileIcon] = useState<string | null>(null);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [customAvatars, setCustomAvatars] = useLocalStorage<string[]>('hyper:custom-avatars', []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { refetch } = useUser();

  const predefinedAvatars = [
    'https://vucvdpamtrjkzmubwlts.supabase.co/storage/v1/object/public/users/user_2zMtrqo9RMaaIn4f8F2z3oeY497/avatar.png',
    'https://plus.unsplash.com/premium_photo-1739163838574-27c663e8a22b?auto=format&fit=crop&q=60&w=900',
    'https://plus.unsplash.com/premium_photo-1739206781762-6b28bac44141?auto=format&fit=crop&q=60&w=900',
    'https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=900&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=900&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=900&auto=format&fit=crop',
  ];

  useEffect(() => {
    if (user?.image) {
      setSelectedProfileIcon(user.image);
    } else {
      try {
        const stored = localStorage.getItem('hyper:selected-profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.icon) {
            setSelectedProfileIcon(parsed.icon);
          }
        }
      } catch {}
    }
  }, [user?.image]);

  const handleSelectAvatar = async (url: string) => {
    setSelectedProfileIcon(url);
    try {
      const stored = localStorage.getItem('hyper:selected-profile');
      const parsed = stored ? JSON.parse(stored) : {};
      localStorage.setItem('hyper:selected-profile', JSON.stringify({
        ...parsed,
        icon: url,
        t: Date.now()
      }));
      await fetch('/api/user/update-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      });
      refetch();
    } catch {}
    setAvatarDialogOpen(false);
    toast.success('Photo de profil mise à jour');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('L\'image doit faire moins de 10MB');
      return;
    }
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error('Upload failed');
      
      const { url } = await uploadRes.json();
      setCustomAvatars((prev) => [url, ...prev.filter(u => u !== url)].slice(0, 6));
      await handleSelectAvatar(url);
    } catch (error) {
      toast.error('Échec de l\'upload');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCustomAvatar = () => {
    if (customAvatarUrl.trim()) {
      handleSelectAvatar(customAvatarUrl.trim());
      setCustomAvatarUrl('');
    }
  };

  const tabs = [
    { value: 'usage', label: 'Utilisation', icon: Analytics01Icon },
    { value: 'preferences', label: 'Préférences', icon: Settings02Icon },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Header with actions */}
      <div className="mt-6">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant={"secondary"}
              size="sm"
              className="h-8 gap-2 !shadow-none"
              onClick={() => router.push('/new')}
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span className="text-sm">Back to Search</span>
            </Button>
            <h1 className="text-lg font-semibold">Paramètres</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ThemeSwitcher />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await signOut({
                    fetchOptions: {
                      onRequest: () => { toast.loading('Signing out...'); },
                      onSuccess: () => {
                        toast.dismiss();
                        toast.success('Signed out');
                        if (typeof window !== 'undefined') window.location.href = '/new';
                      },
                      onError: () => {
                        toast.dismiss();
                        toast.error('Failed to sign out');
                      },
                    },
                  });
                } catch (e) {
                  toast.error('Failed to sign out');
                }
              }}
              className="h-7 px-3 text-xs !shadow-none"
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* User Profile - Mobile */}
        <div className="lg:hidden mb-6">
          <Card className="p-4 shadow-none">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAvatarDialogOpen(true)}
                className="relative group"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user?.image || selectedProfileIcon || ''} className={cn(blurPersonalInfo && 'blur-sm')} />
                  <AvatarFallback>
                    {user?.name
                      ? user.name
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .toUpperCase()
                      : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <PencilSimpleIcon className="h-4 w-4 text-white" />
                </div>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={cn('font-semibold text-lg truncate', blurPersonalInfo && 'blur-sm')}>{user?.name || 'User'}</h3>
                  {isProUser && (
                    <span className="inline-block !font-baumans leading-4 !mb-1 !px-2.5 !pt-0 !pb-1 rounded-xl shadow-sm bg-gradient-to-br from-secondary/25 via-primary/20 to-accent/25 text-foreground ring-1 ring-ring/35 ring-offset-1 ring-offset-background dark:bg-gradient-to-br dark:from-primary dark:via-secondary dark:to-primary dark:text-foreground">
                      pro
                    </span>
                  )}
                </div>
                <p className={cn('text-xs text-muted-foreground truncate', blurPersonalInfo && 'blur-sm')}>{user?.email}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Label htmlFor="blur-personal-mobile" className="text-xs text-muted-foreground">Blur personal info</Label>
              <Switch id="blur-personal-mobile" checked={!!blurPersonalInfo} onCheckedChange={setBlurPersonalInfo} />
            </div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-row gap-6">
          {/* Mobile Dropdown */}
          <div className="lg:hidden">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {tabs.find((t) => t.value === activeTab) && (
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={tabs.find((t) => t.value === activeTab)!.icon}
                        size={16}
                        strokeWidth={1.5}
                      />
                      <span>{tabs.find((t) => t.value === activeTab)!.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={tab.icon} size={16} strokeWidth={1.5} />
                      <span>{tab.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop Sidebar Navigation */}
          <aside className="hidden lg:block lg:w-64 shrink-0 space-y-4 lg:pb-0">
            {/* User Profile Card */}
            <Card className="p-6 shadow-none">
              <div className="flex flex-col items-center text-center space-y-4">
                <button
                  type="button"
                  onClick={() => setAvatarDialogOpen(true)}
                  className="relative group"
                >
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user?.image || selectedProfileIcon || ''} className={cn(blurPersonalInfo && 'blur-sm')} />
                    <AvatarFallback className={cn('text-lg', blurPersonalInfo && 'blur-sm')}>
                      {user?.name
                        ? user.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .toUpperCase()
                        : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <PencilSimpleIcon className="h-5 w-5 text-white" />
                  </div>
                </button>
                <div className="space-y-1 w-full">
                  <h3 className={cn('font-semibold text-base', blurPersonalInfo && 'blur-sm')}>{user?.name || 'User'}</h3>
                  <p className={cn('text-xs text-muted-foreground break-all', blurPersonalInfo && 'blur-sm')}>{user?.email}</p>
                  {isLoading ? (
                    <Skeleton className="h-5 w-16 mx-auto mt-2" />
                  ) : (
                    isProUser && (
                      <span className="inline-block !font-baumans leading-4 !px-2 !pt-0.5 !pb-1.5 rounded-xl shadow-sm bg-gradient-to-br from-secondary/25 via-primary/20 to-accent/25 text-foreground ring-1 ring-ring/35 ring-offset-1 ring-offset-background dark:bg-gradient-to-br dark:from-primary dark:via-secondary dark:to-primary dark:text-foreground mt-2">
                        pro
                      </span>
                    )
                  )}
                </div>
                <div className="w-full pt-3 flex items-center justify-between">
                  <Label htmlFor="blur-personal-desktop" className="text-xs text-muted-foreground">Blur personal info</Label>
                  <Switch id="blur-personal-desktop" checked={!!blurPersonalInfo} onCheckedChange={setBlurPersonalInfo} />
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Card className="p-2 shadow-none">
              <TabsList className="flex flex-col h-auto w-full bg-transparent gap-1">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      'w-full justify-start gap-3 px-4 py-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground',
                      'hover:bg-accent/50 transition-colors !shadow-none',
                    )}
                  >
                    <HugeiconsIcon icon={tab.icon} size={18} strokeWidth={1.5} />
                    <span className="font-medium">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Card>
          </aside>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <Card className="p-0 shadow-none bg-transparent border-none">
              <TabsContent value="usage" className="m-0">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">Statistiques d'utilisation</h2>
                    <p className="text-sm text-muted-foreground">Suivez votre utilisation quotidienne et mensuelle</p>
                  </div>
                  <UsageSection user={user} />
                </div>
              </TabsContent>

              <TabsContent value="preferences" className="m-0">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">Préférences</h2>
                    <p className="text-sm text-muted-foreground">Personnalisez votre expérience de recherche et d'IA</p>
                  </div>
                  <PreferencesSection user={user} />
                </div>
              </TabsContent>


            </Card>
          </div>
        </Tabs>
      </div>
      {/* Avatar Selection Dialog */}
      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choisir une photo de profil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {customAvatars.length > 0 && (
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Vos photos</Label>
                <div className="grid grid-cols-3 gap-3">
                  {customAvatars.map((url, index) => (
                    <button
                      key={`custom-${index}`}
                      type="button"
                      onClick={() => handleSelectAvatar(url)}
                      className={cn(
                        "relative aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-105",
                        (user?.image === url || selectedProfileIcon === url) ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"
                      )}
                    >
                      <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Avatars par défaut</Label>
              <div className="grid grid-cols-3 gap-3">
                {predefinedAvatars.map((url, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectAvatar(url)}
                    className={cn(
                      "relative aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-105",
                      (user?.image === url || selectedProfileIcon === url) ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"
                    )}
                  >
                    <img src={url} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t pt-4 space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Importer depuis votre galerie</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <><Spinner className="mr-2 h-4 w-4" /> Upload en cours...</>
                  ) : (
                    <><UploadIcon className="mr-2 h-4 w-4" /> Choisir une image</>
                  )}
                </Button>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Ou entrez une URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/photo.jpg"
                    value={customAvatarUrl}
                    onChange={(e) => setCustomAvatarUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleCustomAvatar} disabled={!customAvatarUrl.trim()}>
                    Appliquer
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <div className="border-b border-border/40">
            <div className="container mx-auto px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8" />
              <div className="h-5 w-24 bg-muted rounded" />
            </div>
          </div>
          <div className="container mx-auto px-4 py-6">
            <div className="h-10 w-40 bg-muted rounded mb-4" />
            <div className="h-64 w-full bg-muted rounded" />
          </div>
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}
