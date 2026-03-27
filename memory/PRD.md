# PRD - Hyper App Toast Morphing Fix

## Problem Statement
L'utilisateur voulait que TOUS les toasts Sileo aient l'effet de morphing SVG gooey (forme en deux parties: titre + description) au lieu de la forme simple arrondie sans morphing.

## Architecture
- Next.js application with Sileo toast library (v0.1.5)
- Sileo provides physics-based toast with gooey SVG morphing
- The morphing effect is triggered by the `description` property in toast calls

## What Was Implemented (Jan 2026)

### Phase 1 - Clipboard toasts
- Added `description` to all clipboard copy toast calls (5 files, 11 toasts)

### Phase 2 - ALL remaining toasts
- Added `description` to every single sileo toast call across the entire codebase
- **13 files modified**, ~107 toast calls updated
- Files modified:
  - `app/(auth)/sign-in/page.tsx`
  - `app/settings/page.tsx`
  - `components/chat-history-dialog.tsx`
  - `components/chat-interface.tsx`
  - `components/dialogs/share-dialog.tsx`
  - `components/markdown.tsx`
  - `components/message-parts/index.tsx`
  - `components/message/_main.tsx`
  - `components/settings-dialog.tsx`
  - `components/share/share-dialog.tsx`
  - `components/ui/form-component.tsx`
  - `components/ui/form/ModelSwitcher.tsx`
  - `components/user-profile.tsx`
- Verification: Python script confirms 0 toast calls without `description` remaining

## Backlog
- No additional items requested

## Next Tasks
- Test the app to verify all toasts display the gooey morphing effect
