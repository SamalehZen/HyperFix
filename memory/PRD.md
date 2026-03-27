# PRD - Hyper App Toast Enhancements

## Problem Statement
1. L'utilisateur voulait que tous les toasts Sileo aient l'effet de morphing SVG gooey
2. L'utilisateur voulait personnaliser les icônes de chaque type de toast pour une expérience distinctive

## Architecture
- Next.js application with Sileo toast library (v0.1.5)
- Icons: Lucide React (primary for toasts) + HugeIcons (existing branding)

## What Was Implemented (Jan 2026)

### Phase 1 - Morphing SVG sur tous les toasts
- Added `description` to all 123 sileo toast calls
- 13 files modified

### Phase 2 - Icônes personnalisées par catégorie
- Added custom `icon` property to all 123 toast calls
- Icon mapping by action type:
  - **Clipboard/Copy** → `ClipboardCheck`
  - **PDF** → `FileText`
  - **Upload/Files** → `Upload`
  - **Share/Public** → `Globe`
  - **Private** → `Lock`
  - **Sign out** → `LogOut`
  - **Profile** → `UserCheck`, `Camera`
  - **Image errors** → `ImageOff`
  - **Delete** → `Trash`
  - **Edit/Title** → `Pencil`
  - **Voice/Speech** → `Mic`
  - **Prompt enhance** → `Wand2`
  - **Safety/Moderation** → `Shield`, `ShieldAlert`
  - **Connection** → `WifiOff`
  - **Subscription** → `Zap`
  - **Code wrap** → `WrapText`
  - **File URL** → `Link`
  - **Message** → `MessageSquare`
  - **General alert** → `AlertCircle`
  - **Rate limit/Wait** → `Clock`
  - **Image paste** → `Image`
  - **Settings** → `SlidersHorizontal`
  - **Excel** → `FileSpreadsheet`
  - **Model switch** → `CpuIcon` (HugeIcons, already existing)

### Files Modified (13 files)
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

## Verification
- Python script confirms: 123 total toasts, 0 missing description, 0 missing icon

## Backlog
- No additional items requested
