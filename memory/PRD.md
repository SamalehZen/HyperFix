# PRD - Hyper App Toast Fix

## Problem Statement
L'utilisateur voulait que les toasts "Copied to clipboard" aient la forme Sileo avec l'effet gooey SVG morphing (deux parties: titre + description) au lieu de la forme simple arrondie.

## Architecture
- Next.js application with Sileo toast library (v0.1.5)
- Sileo provides physics-based toast with gooey SVG morphing

## What Was Implemented (Jan 2026)
- Added `description` property to ALL clipboard copy toast calls across 5 files
- Files modified:
  - `components/message-parts/index.tsx`
  - `components/message/_main.tsx` (4 toast calls)
  - `components/markdown.tsx` (4 toast calls)
  - `components/share/share-dialog.tsx`
  - `components/dialogs/share-dialog.tsx`
- The `description` property triggers Sileo's gooey SVG morphing effect, creating the two-part speech bubble shape

## Backlog
- No additional items requested
