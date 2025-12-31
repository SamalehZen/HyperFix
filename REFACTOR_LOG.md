# REFACTOR LOG - Version Lite

## Objectif
Créer une version lite de l'application en conservant uniquement:
- Chat AI Core (interface de conversation)
- Agents métier: Cyrus, Libeller correction, Nomenclature douanière, PDF to Excel, EAN Expert
- Auth local (username/password)
- Real-time Pusher

---

## Phase 1: Analyse préalable

### Fichiers à conserver (NE PAS TOUCHER)
- `app/(search)/` - Core search
- `app/(auth)/` - Auth pages
- `app/api/search/` - Search API (à modifier pour retirer les outils)
- `app/api/local-auth/` - Auth API
- `app/api/chat/` - Chat API
- `app/api/pusher/` - Pusher API
- `app/api/heartbeat/` - Heartbeat API
- `components/chat-*.tsx` - Chat components
- `components/message*.tsx` - Message components
- `lib/db/` - Database (garder intact)
- `lib/pusher*.ts` - Pusher files
- `ai/prompts/` - Prompts agents métier

### Outils à conserver
- `lib/tools/datetime.ts` - Datetime tool
- `lib/tools/greeting.ts` - Greeting tool
- `lib/tools/ean-search.ts` - EAN search (agent métier)
- `lib/tools/index.ts` - À modifier

---

## Phase 2: Suppression des pages et routes

### Pages supprimées
| Fichier/Dossier | Raison | Références trouvées |
|-----------------|--------|---------------------|
| `app/admin/` | Module admin hors scope | navbar, middleware, admin components |
| `app/lookout/` | Recherche programmée Pro | user-profile, chat-dialogs, about page |
| `app/pricing/` | Page tarification | navbar, settings-dialog, checkout |
| `app/checkout/` | Page checkout | pricing-table |
| `app/success/` | Page succès paiement | checkout |
| `app/xql/` | Interface XQL Pro | user-profile, middleware |
| `app/connectors/` | Connecteurs externes | actions.ts |
| `app/examples/` | Page exemples | Aucune référence directe |
| `app/about/` | Page about | terms, privacy-policy |

### Routes API supprimées
| Route | Raison |
|-------|--------|
| `app/api/admin/` | Admin API |
| `app/api/lookout/` | Lookout API |
| `app/api/xql/` | XQL API |
| `app/api/raycast/` | Intégration Raycast |
| `app/api/og/` | OG Image generation |
| `app/api/auth/dodopayments/` | Webhook DodoPayments |
| `app/api/auth/polar/` | Webhook Polar |
| `app/api/clean_images/` | Nettoyage images |
| `app/api/transcribe/` | Transcription |
| `app/api/debug/` | Debug endpoints |
| `app/api/db-debug/` | Debug DB |

---

## Phase 3: Suppression des outils AI

### Outils supprimés de lib/tools/
| Fichier | Raison | Importé dans |
|---------|--------|--------------|
| `academic-search.ts` | Hors scope | index.ts, route.ts, types.ts |
| `code-context.ts` | Hors scope | index.ts, route.ts, types.ts |
| `code-interpreter.ts` | Hors scope | index.ts, route.ts, types.ts |
| `connectors-search.ts` | Hors scope | index.ts, route.ts, types.ts |
| `crypto-tools.ts` | Hors scope | index.ts, route.ts, types.ts |
| `currency-converter.ts` | Hors scope | index.ts, route.ts, types.ts |
| `extreme-search.ts` | Hors scope | index.ts, route.ts, types.ts |
| `flight-tracker.ts` | Hors scope | index.ts, route.ts, types.ts |
| `js-run-tool.ts` | Hors scope | index.ts, route.ts, types.ts |
| `map-tools.ts` | Hors scope | index.ts, route.ts, types.ts |
| `mcp-search.ts` | Déjà commenté | index.ts |
| `movie-tv-search.ts` | Hors scope | index.ts, route.ts, types.ts |
| `python-run-tool.ts` | Hors scope | index.ts, route.ts, types.ts |
| `reddit-search.ts` | Hors scope | index.ts, route.ts, types.ts |
| `retrieve.ts` | Hors scope | index.ts, route.ts, types.ts |
| `stock-chart.ts` | Hors scope | index.ts, route.ts, types.ts |
| `supermemory.ts` | Hors scope | index.ts, route.ts, types.ts |
| `text-translate.ts` | Hors scope | index.ts, route.ts, types.ts |
| `trending-movies.ts` | Hors scope | index.ts, route.ts, types.ts |
| `trending-tv.ts` | Hors scope | index.ts, route.ts, types.ts |
| `weather.ts` | Hors scope | index.ts, route.ts, types.ts |
| `web-search.ts` | Hors scope | index.ts, route.ts, types.ts |
| `x-search.ts` | Hors scope | index.ts, route.ts, types.ts |
| `youtube-search.ts` | Hors scope | index.ts, route.ts, types.ts |
| `visualization/` | Dossier entier | index.ts, tests |

---

## Phase 4: Suppression des composants UI

### Composants supprimés
| Fichier | Raison | Importé dans |
|---------|--------|--------------|
| `academic-papers.tsx` | Hors scope | message-parts/index.tsx |
| `connectors-search-results.tsx` | Hors scope | message-parts/index.tsx |
| `crypto-charts.tsx` | Hors scope | message-parts/index.tsx |
| `crypto-coin-data.tsx` | Hors scope | message-parts/index.tsx |
| `currency_conv.tsx` | Hors scope | message-parts/index.tsx |
| `extreme-search.tsx` | Hors scope | message-parts/index.tsx |
| `flight-tracker.tsx` | Hors scope | message-parts/index.tsx |
| `interactive-charts.tsx` | Hors scope | message-parts/index.tsx |
| `interactive-maps.tsx` | Hors scope | nearby-search-map-view |
| `interactive-stock-chart.tsx` | Hors scope | message-parts/index.tsx |
| `map-components.tsx` | Hors scope | message-parts/index.tsx |
| `mcp-server-list.tsx` | Hors scope | message-parts/index.tsx |
| `memory-dialog.tsx` | Hors scope | Non utilisé |
| `movie-info.tsx` | Hors scope | message-parts/index.tsx |
| `multi-search.tsx` | Hors scope | message-parts/index.tsx |
| `nearby-search-map-view.tsx` | Hors scope | message-parts/index.tsx |
| `nutrition-scores.tsx` | Hors scope | message-parts/index.tsx |
| `nutrition-table.tsx` | Hors scope | message-parts/index.tsx |
| `onchain-crypto-components.tsx` | Hors scope | message-parts/index.tsx |
| `place-card.tsx` | Hors scope | nearby-search-map-view |
| `reddit-search.tsx` | Hors scope | message-parts/index.tsx |
| `trending-tv-movies-results.tsx` | Hors scope | message-parts/index.tsx |
| `weather-chart.tsx` | Hors scope | message-parts/index.tsx |
| `x-search.tsx` | Hors scope | message-parts/index.tsx, extreme-search |
| `xql-pro-upgrade-screen.tsx` | Hors scope | xql/page.tsx |
| `youtube-search-results.tsx` | Hors scope | message-parts/index.tsx |
| `admin/` | Dossier entier | admin pages |
| `student-domain-request-button.tsx` | Hors scope | pricing-table |
| `supported-domains-list.tsx` | Hors scope | pricing-table |

---

## Phase 5: Suppression des fichiers de support

### Hooks supprimés
| Fichier | Raison |
|---------|--------|
| `hooks/use-lookouts.ts` | Lookout hors scope |
| `hooks/use-github-stars.ts` | Non nécessaire |

### Lib supprimés
| Fichier/Dossier | Raison |
|-----------------|--------|
| `lib/code-runner/` | Code execution hors scope |
| `lib/discount.ts` | Pricing hors scope |
| `lib/export-xlsx.ts` | Export Excel (garder si utilisé par PDF to Excel agent) |
| `lib/gemini-key-manager.ts` | Gestion clés Gemini hors scope |
| `lib/subscription.ts` | Subscription hors scope |

---

## Phase 6: Dépendances à retirer

### Dependencies
- `@daytonaio/sdk`
- `@dodopayments/core`
- `@mendable/firecrawl-js`
- `@polar-sh/sdk`
- `@upstash/qstash`
- `canvas-confetti`
- `dodopayments`
- `echarts`
- `echarts-for-react`
- `leaflet`
- `mermaid`
- `xlsx` (vérifier si utilisé par PDF to Excel)
- `youtube-caption-extractor`
- `@foobar404/wave`
- `cron-parser`

### DevDependencies
- `@types/leaflet`

---

## Phase 7: Fichiers de configuration à modifier

### Fichiers modifiés
- `lib/tools/index.ts` - Retirer exports des outils supprimés
- `app/api/search/route.ts` - Retirer imports et usages des outils
- `lib/types.ts` - Retirer types des outils supprimés
- `components/message-parts/index.tsx` - Retirer lazy imports et handlers
- `app/layout.tsx` - Retirer import leaflet CSS
- `middleware.ts` - Simplifier routes protégées
- `ai/providers.ts` - Réduire liste des modèles
- `app/actions.ts` - Retirer actions liées aux features supprimées
- `components/user-profile.tsx` - Retirer liens vers pages supprimées
- `components/navbar.tsx` - Simplifier navigation
- `components/settings-dialog.tsx` - Retirer références pricing

---

## Progression

- [x] Phase 1: Analyse préalable (REFACTOR_LOG.md créé)
- [x] Phase 2: Suppression pages et routes
- [x] Phase 3: Suppression outils AI
- [x] Phase 4: Suppression composants UI
- [x] Phase 5: Suppression fichiers support
- [x] Phase 6: Nettoyage dépendances
- [x] Phase 7: Mise à jour configs
- [x] Phase 8: Validation finale (build échoue uniquement par manque de variables d'environnement)

---

## Résumé des changements

### Pages/Routes supprimées
- `app/admin/` - Module admin complet
- `app/lookout/` - Recherche programmée Pro
- `app/pricing/` - Page tarification
- `app/checkout/` - Page checkout
- `app/success/` - Page succès paiement
- `app/xql/` - Interface XQL
- `app/connectors/` - Connecteurs externes
- `app/examples/` - Exemples
- `app/about/` - Page about
- `app/api/admin/` - API Admin
- `app/api/lookout/` - API Lookout
- `app/api/xql/` - API XQL
- `app/api/raycast/` - API Raycast
- `app/api/og/` - OG Image generation
- `app/api/auth/dodopayments/` - Webhooks DodoPayments
- `app/api/auth/polar/` - Webhooks Polar
- `app/api/clean_images/` - Nettoyage images
- `app/api/transcribe/` - Transcription
- `app/api/debug/` - Debug endpoints
- `app/api/db-debug/` - Debug DB

### Outils AI supprimés (lib/tools/)
24 outils supprimés, gardés uniquement:
- `datetime.ts`
- `greeting.ts`
- `ean-search.ts`

### Composants UI supprimés
28 composants supprimés dont:
- Tous les composants admin
- Composants de recherche avancée (extreme-search, multi-search, etc.)
- Composants média (movie-info, youtube-search, etc.)
- Composants crypto/finance (crypto-charts, stock-chart, etc.)
- Composants maps (map-components, nearby-search, etc.)

### Fichiers support supprimés
- `hooks/use-lookouts.ts`
- `hooks/use-github-stars.ts`
- `lib/code-runner/` (dossier complet)
- `lib/discount.ts`
- `lib/gemini-key-manager.ts`
- `lib/subscription.ts`
- `lib/connectors.tsx`

### Dépendances retirées de package.json
- `@daytonaio/sdk`
- `@dodopayments/core`
- `@mendable/firecrawl-js`
- `@polar-sh/sdk`
- `@upstash/qstash`
- `canvas-confetti`
- `dodopayments`
- `echarts`
- `echarts-for-react`
- `leaflet`
- `mermaid`
- `youtube-caption-extractor`
- `@foobar404/wave`
- `cron-parser`
- `supermemory`
- `@react-email/components`
- `@types/leaflet`
- `@types/canvas-confetti`

### Fichiers de configuration modifiés
- `lib/tools/index.ts` - Exports simplifiés
- `app/api/search/route.ts` - Outils réduits
- `lib/types.ts` - Types simplifiés
- `components/message-parts/index.tsx` - Handlers réduits
- `app/layout.tsx` - Import leaflet CSS retiré
- `middleware.ts` - Routes simplifiées
