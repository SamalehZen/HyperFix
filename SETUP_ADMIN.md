# 🚀 Configuration Initiale du Dashboard Admin HyperFix

Ce guide vous accompagne dans la mise en place du dashboard administrateur de HyperFix, de la création de la base de données jusqu'à la connexion au dashboard.

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir :

- **PostgreSQL** configuré (Neon ou autre)
- **Node.js** 20+ installé
- **pnpm** installé (`npm install -g pnpm`)
- **Variables d'environnement** configurées (voir `.env.example`)

## 🔧 Installation Complète

### Étape 1 : Configuration de l'environnement

1. Clonez le projet et installez les dépendances :

```bash
git clone [votre-repo]
cd HyperFix
pnpm install
```

2. Créez le fichier `.env.local` à la racine du projet :

```bash
cp .env.example .env.local
```

3. Configurez vos variables d'environnement dans `.env.local` :

```env
# Base de données (OBLIGATOIRE)
DATABASE_URL=postgresql://user:password@host/database

# Admin personnalisé (OPTIONNEL - valeurs par défaut fournies)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@hyper.local

# Autres variables...
```

### Étape 2 : Migration de la base de données

Créez les tables dans votre base de données PostgreSQL :

```bash
pnpm db:push
```

Cette commande va créer toutes les tables nécessaires :
- `user` - Utilisateurs de l'application
- `users` - Credentials pour l'authentification locale
- `chat` - Conversations
- `message` - Messages et métriques AI
- `event` - Événements système
- Et autres tables...

### Étape 3 : Créer le premier administrateur

Exécutez le script de création d'admin :

```bash
pnpm seed:admin
```

Ce script va créer **3 utilisateurs** :

| Rôle | Username | Password | Description |
|------|----------|----------|-------------|
| 👑 Admin | `sam` | `sam` | Administrateur principal |
| 👑 Admin | `admin` | `admin123` | Admin personnalisable (voir variables d'env) |
| 👤 User | `demo` | `demo123` | Utilisateur de démonstration |

> **Note** : Pour personnaliser l'admin secondaire, modifiez les variables `ADMIN_USERNAME`, `ADMIN_PASSWORD` et `ADMIN_EMAIL` dans `.env.local` avant d'exécuter le script.

### Étape 4 : Générer des données de test (optionnel mais recommandé)

Pour avoir un dashboard avec des données réalistes :

```bash
pnpm seed:test-data
```

Ce script génère :
- **8 utilisateurs** de test (Alice, Bob, Charlie, Diana, Eve, Frank, Grace, Henry)
- **25 conversations** avec des titres variés
- **150-200 messages** répartis sur les 7 derniers jours
- **30-50 événements système** (login, logout, erreurs, etc.)

Les données incluent :
- Mix de modèles AI (Gemini 1.5 Pro, Gemini 2.0 Flash, GPT-4, Claude)
- Tokens réalistes (200-2000 input, 100-1500 output)
- Temps de complétion (1-5 secondes)
- Statuts variés (active, suspended, deleted)
- IPs et géolocalisation aléatoires

### Étape 5 : Démarrer l'application

```bash
pnpm dev
```

L'application sera accessible sur **http://localhost:3000**

### Étape 6 : Se connecter au Dashboard Admin

1. **Connexion** : Allez sur http://localhost:3000/sign-in
2. **Credentials** : Utilisez `sam` / `sam` (ou vos credentials personnalisés)
3. **Dashboard** : Accédez à http://localhost:3000/admin

## ✅ Vérification

Votre dashboard doit maintenant afficher :

- ✅ **KPIs avec des chiffres** (Total Users, Active Sessions, Messages Today, etc.)
- ✅ **Graphiques avec données** (Top 15 AI Models, Token Usage Over Time, etc.)
- ✅ **Liste d'utilisateurs** avec statuts, rôles, dernière connexion
- ✅ **Événements récents** dans l'onglet Logs
- ✅ **Santé système** (peut afficher "?" si aucun message AI réel)

### Exemple de KPIs attendus (avec données de test) :

```
Total Users: 11          (3 admin + 8 test users)
Active Users: 9          (excludes suspended/deleted)
Messages Today: 20-40    (selon la distribution aléatoire)
Total Chats: 25
Avg Response Time: 2.5s
Token Usage: 150-300K
```

## 🔄 Scripts Disponibles

| Commande | Description |
|----------|-------------|
| `pnpm seed:admin` | Créer les utilisateurs admin uniquement |
| `pnpm seed:test-data` | Générer des données de test |
| `pnpm seed:all` | Exécuter admin + test data en une fois |
| `pnpm seed:reset` | Réinitialiser la DB + tout recréer |
| `pnpm dev` | Démarrer le serveur de développement |
| `pnpm db:push` | Pousser les migrations vers la DB |

## 🐛 Troubleshooting

### Problème : "Connection refused" ou "Database error"

**Solution** :
1. Vérifiez que `DATABASE_URL` est correct dans `.env.local`
2. Testez la connexion : `psql $DATABASE_URL`
3. Vérifiez que votre instance PostgreSQL est démarrée

### Problème : "Table does not exist"

**Solution** :
```bash
pnpm db:push
```

Si l'erreur persiste, supprimez le dossier `drizzle/` et relancez.

### Problème : Le dashboard affiche "—" ou pas de données

**Solution** :
1. Vérifiez que vous avez exécuté `pnpm seed:test-data`
2. Les KPIs nécessitent des messages des dernières 24h
3. Réexécutez le seed : `pnpm seed:test-data` (les données ne sont pas dupliquées)

### Problème : "Cannot find module 'tsx'"

**Solution** :
```bash
pnpm add -D tsx
```

### Problème : Impossible de se connecter avec sam/sam

**Solution** :
1. Vérifiez que le seed admin s'est bien exécuté
2. Réexécutez : `pnpm seed:admin`
3. Vérifiez dans la console qu'il n'y a pas d'erreur
4. Testez avec les autres comptes (admin/admin123, demo/demo123)

### Problème : Les graphiques sont vides

**Solution** :

Les graphiques nécessitent des **messages avec métriques AI** :
- Exécutez `pnpm seed:test-data`
- Attendez quelques secondes que le cache se rafraîchisse
- Rechargez la page du dashboard

### Problème : Erreur "bcryptjs not found"

**Solution** :
```bash
pnpm install bcryptjs
```

Le package devrait déjà être installé, mais si ce n'est pas le cas, installez-le manuellement.

## 📊 Structure des Données

### Table `user` (Utilisateurs de l'application)

```typescript
{
  id: "local:username",
  name: "Username",
  email: "user@example.com",
  role: "admin" | "user",
  status: "active" | "suspended" | "deleted",
  lastSeen: Date,
  ipAddress: "192.168.1.1",
  geo: { city, country, lat, lon },
  createdAt: Date,
  updatedAt: Date
}
```

### Table `users` (Credentials)

```typescript
{
  username: "sam",
  passwordHash: "bcrypt_hash",
  createdAt: Date
}
```

### Table `message` (Messages avec métriques AI)

```typescript
{
  id: "uuid",
  chatId: "uuid",
  role: "user" | "assistant",
  parts: [{type: "text", text: "..."}],
  model: "google-gemini-1.5-pro",
  inputTokens: 500,
  outputTokens: 300,
  totalTokens: 800,
  completionTime: 2.5, // secondes
  createdAt: Date
}
```

### Table `event` (Événements système)

```typescript
{
  id: "uuid",
  category: "security" | "user" | "system",
  type: "login" | "logout" | "user_created" | ...,
  message: "User sam logged in from 192.168.1.1",
  metadata: { ip, userAgent, timestamp },
  userId: "local:username",
  createdAt: Date
}
```

## 🔒 Sécurité

### Passwords

- Les passwords sont hashés avec **bcryptjs** (10 rounds)
- Le backend accepte aussi **Argon2** pour la rétrocompatibilité
- Ne jamais committer de passwords en clair
- Changez les passwords par défaut en production !

### Sessions

- Les sessions utilisent des **cookies signés**
- Authentification locale via `/api/local-auth/login`
- Déconnexion via `/api/auth/logout`

### Environnement

- **JAMAIS** committer `.env.local`
- Utilisez `.env.example` comme template
- Générez des secrets forts en production

## 🚀 Déploiement en Production

### 1. Variables d'environnement

```env
DATABASE_URL=postgresql://...         # Base de données production
NODE_ENV=production
ADMIN_USERNAME=votre_admin           # Changez les valeurs par défaut !
ADMIN_PASSWORD=votre_password_fort   # Utilisez un password fort !
ADMIN_EMAIL=admin@votre-domaine.com
```

### 2. Initialisation

```bash
# En production, utilisez uniquement seed:admin
pnpm db:push
pnpm seed:admin

# N'utilisez PAS seed:test-data en production !
```

### 3. Build et démarrage

```bash
pnpm build
pnpm start
```

## 📚 Ressources

- **README.md** - Documentation générale du projet
- **README_ADMIN.md** - Documentation du dashboard admin
- **lib/db/schema.ts** - Schéma de la base de données
- **app/admin/** - Code source du dashboard

## 🤝 Support

En cas de problème :

1. Vérifiez cette documentation
2. Consultez les logs du serveur (`pnpm dev`)
3. Vérifiez les logs PostgreSQL
4. Ouvrez une issue sur GitHub avec :
   - Description du problème
   - Logs d'erreur
   - Étapes pour reproduire

## ✨ Fonctionnalités du Dashboard

Une fois connecté, vous aurez accès à :

### Page Principale (`/admin`)
- **KPIs en temps réel** : Utilisateurs, sessions, messages, tokens
- **Graphiques** : Top 15 modèles AI, usage de tokens, temps de réponse
- **Liste d'utilisateurs** : Gestion, statuts, dernière activité
- **Événements récents** : Logs système en direct
- **Santé système** : Statut de l'API et de la base de données

### Gestion des Utilisateurs (`/admin/users`)
- Liste complète des utilisateurs
- Filtres par rôle et statut
- Actions : Suspendre, Activer, Supprimer
- Création de nouveaux utilisateurs
- Profils détaillés avec historique

### Logs Système (`/admin/logs`)
- Historique complet des événements
- Filtres par catégorie (security, user, system)
- Recherche par type d'événement
- Export des logs

### Paramètres (`/admin/settings`)
- Configuration système
- Variables d'environnement
- Maintenance

---

**Bon développement ! 🚀**

*Documentation créée pour HyperFix Admin Dashboard v1.0*
