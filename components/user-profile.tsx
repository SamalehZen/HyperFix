'use client';

import { useState, memo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSession, signOut } from '@/lib/auth-client';
import { sileo } from 'sileo';
import {
  SignOutIcon,
  SignInIcon,
  EyeIcon,
  EyeSlashIcon,
  GearIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { User } from '@/lib/db/schema';
import { SignInPromptDialog } from '@/components/sign-in-prompt-dialog';

// User Profile Component - focused on user authentication and account management
const UserProfile = memo(
  ({
    className,
    user,
    subscriptionData,
    isProUser,
    isProStatusLoading,
    isCustomInstructionsEnabled,
    setIsCustomInstructionsEnabled,
  }: {
    className?: string;
    user?: User | null;
    subscriptionData?: any;
    isProUser?: boolean;
    isProStatusLoading?: boolean;
    isCustomInstructionsEnabled?: boolean;
    setIsCustomInstructionsEnabled?: (value: boolean | ((val: boolean) => boolean)) => void;
  }) => {
    const [signingOut, setSigningOut] = useState(false);
    const [signingIn, setSigningIn] = useState(false);
    const [signInDialogOpen, setSignInDialogOpen] = useState(false);
    const [showEmail, setShowEmail] = useState(false);
    const [blurPersonalInfo] = useLocalStorage<boolean>('hyper-blur-personal-info', false);
    const [selectedProfileIcon, setSelectedProfileIcon] = useState<string | null>(null);
    const { data: session, isPending } = useSession();
    const router = useRouter();

    useEffect(() => {
      try {
        const stored = localStorage.getItem('hyper:selected-profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.icon) {
            setSelectedProfileIcon(parsed.icon);
          }
        }
      } catch {}
    }, []);

    // Use passed user prop if available, otherwise fall back to session
    // BUT only use session for authentication check, not for settings dialog data
    const currentUser = user || session?.user;
    const isAuthenticated = !!(user || session);

    // For settings dialog, always use the passed user prop (has unified data structure)
    const settingsUser = user;

    // Use passed Pro status instead of calculating it
    const hasActiveSubscription = isProUser;

    if (isPending && !user) {
      return (
        <div className="h-8 w-8 flex items-center justify-center">
          <div className="size-4 rounded-full bg-muted/50 animate-pulse"></div>
        </div>
      );
    }

    // Function to format email for display
    const formatEmail = (email?: string | null) => {
      if (!email) return '';

      // If showing full email, don't truncate it
      if (showEmail) {
        return email;
      }

      // If hiding email, show only first few characters and domain
      const parts = email.split('@');
      if (parts.length === 2) {
        const username = parts[0];
        const domain = parts[1];
        const maskedUsername = username.slice(0, 3) + '•••';
        return `${maskedUsername}@${domain}`;
      }

      // Fallback for unusual email formats
      return email.slice(0, 3) + '•••';
    };

    return (
      <>
        {isAuthenticated ? (
          // Authenticated user - show avatar dropdown with account options
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn('!p-0 !m-0', signingOut && 'animate-pulse', className)}
                    asChild
                  >
                    <Avatar className="size-6 rounded-full border border-neutral-200 dark:border-neutral-700 !p-0 !m-0">
                      <AvatarImage
                        src={currentUser?.image || selectedProfileIcon || ''}
                        alt={currentUser?.name ?? ''}
                        className="rounded-md !p-0 !m-0 size-6"
                      />
                      <AvatarFallback className="rounded-md text-sm !p-0 !m-0 size-6">
                        {currentUser?.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Account
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-[240px] z-[110] mr-5">
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <Avatar className="size-8 shrink-0 rounded-md border border-neutral-200 dark:border-neutral-700">
                    <AvatarImage
                      src={currentUser?.image || selectedProfileIcon || ''}
                      alt={currentUser?.name ?? ''}
                      className={cn('rounded-md p-0 m-0 size-8', blurPersonalInfo && 'blur-sm')}
                    />
                    <AvatarFallback className={cn('rounded-md p-0 m-0 size-8', blurPersonalInfo && 'blur-sm')}>
                      {currentUser?.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <p className={cn('font-medium text-sm leading-none truncate', blurPersonalInfo && 'blur-sm')}>
                      {currentUser?.name}
                    </p>
                    <div className="flex items-center mt-0.5 gap-1">
                      <div
                        className={cn(
                          'text-xs text-muted-foreground',
                          showEmail ? '' : 'max-w-[160px] truncate',
                          blurPersonalInfo && 'blur-sm',
                        )}
                        title={currentUser?.email || ''}
                      >
                        {formatEmail(currentUser?.email)}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEmail(!showEmail);
                        }}
                        className="size-6 text-muted-foreground hover:text-foreground"
                      >
                        {showEmail ? <EyeSlashIcon size={12} /> : <EyeIcon size={12} />}
                        <span className="sr-only">{showEmail ? 'Hide email' : 'Show email'}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/settings')}>
                <div className="w-full flex items-center gap-2">
                  <GearIcon size={16} />
                  <span>Paramètres</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer w-full flex items-center justify-between gap-2"
                onClick={() =>
                  signOut({
                    fetchOptions: {
                      onRequest: () => {
                        setSigningOut(true);
                        sileo.show({ title: 'Signing out...' });
                      },
                      onSuccess: () => {
                        setSigningOut(false);
                        localStorage.clear();
                        sileo.clear();
                        sileo.success({ title: 'Signed out successfully' });
                        window.location.href = '/sign-in';
                      },
                      onError: () => {
                        setSigningOut(false);
                        sileo.error({ title: 'Failed to sign out' });
                        window.location.reload();
                      },
                    },
                  })
                }
              >
                <span>Déconnexion</span>
                <SignOutIcon className="size-4" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // Unauthenticated user - show simple sign in button
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className={cn(
                  'h-7 px-2.5 text-xs rounded-md shadow-sm group',
                  'hover:scale-[1.02] active:scale-[0.98] transition-transform',
                  signingIn && 'animate-pulse',
                  className,
                )}
                onClick={() => {
                  setSigningIn(true);
                  setSignInDialogOpen(true);
                }}
              >
                <SignInIcon className="size-3.5 mr-1.5" />
                <span>Sign in</span>
                <span className="ml-1.5 hidden sm:inline text-[9px] px-1.5 py-0.5 rounded-full bg-primary-foreground/15 text-primary-foreground/90">
                  Free
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Sign in to save progress and sync across devices
            </TooltipContent>
          </Tooltip>
        )}

        <SignInPromptDialog
          open={signInDialogOpen}
          onOpenChange={(open) => {
            setSignInDialogOpen(open);
            if (!open) setSigningIn(false);
          }}
        />
      </>
    );
  },
);

// Add a display name for the memoized component for better debugging
UserProfile.displayName = 'UserProfile';

export { UserProfile };
