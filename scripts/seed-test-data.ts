import { db } from '@/lib/db';
import { user as appUser, users as credentials, chat, message, event } from '@/lib/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { generateId } from 'ai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ============================================================================
// Helpers pour générer des données aléatoires
// ============================================================================

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number, hoursAgo?: number): Date {
  const now = new Date();
  const minMs = hoursAgo ? hoursAgo * 60 * 60 * 1000 : 0;
  const maxMs = daysAgo * 24 * 60 * 60 * 1000;
  const randomMs = Math.random() * (maxMs - minMs) + minMs;
  return new Date(now.getTime() - randomMs);
}

function randomIP(): string {
  return `${randomBetween(1, 255)}.${randomBetween(0, 255)}.${randomBetween(0, 255)}.${randomBetween(1, 255)}`;
}

function randomGeo() {
  const cities = [
    { city: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
    { city: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
    { city: 'New York', country: 'United States', lat: 40.7128, lon: -74.006 },
    { city: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
    { city: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
    { city: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
    { city: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
    { city: 'Dubai', country: 'UAE', lat: 25.2048, lon: 55.2708 },
  ];
  return randomElement(cities);
}

// ============================================================================
// Génération des utilisateurs de test
// ============================================================================

async function seedTestUsers() {
  console.log('\n👥 Création des utilisateurs de test...\n');

  const testUsers = [
    { username: 'alice', role: 'user' as const, status: 'active' as const },
    { username: 'bob', role: 'admin' as const, status: 'active' as const },
    { username: 'charlie', role: 'user' as const, status: 'active' as const },
    { username: 'diana', role: 'user' as const, status: 'active' as const },
    { username: 'eve', role: 'user' as const, status: 'suspended' as const },
    { username: 'frank', role: 'admin' as const, status: 'active' as const },
    { username: 'grace', role: 'user' as const, status: 'active' as const },
    { username: 'henry', role: 'user' as const, status: 'deleted' as const },
  ];

  const createdUserIds: string[] = [];

  for (const testUser of testUsers) {
    try {
      const userId = `local:${testUser.username}`;
      const email = `${testUser.username}@test.local`;
      const password = `${testUser.username}123`;
      const now = new Date();
      const createdAt = randomDate(60);
      const lastSeen = testUser.status === 'active' ? randomDate(7) : null;

      const mod = await import('bcryptjs');
      const bcrypt = (mod as any).default ?? (mod as any);
      const passwordHash = await bcrypt.hash(password, 10);

      // Créer les credentials
      await db
        .insert(credentials)
        .values({ username: testUser.username, passwordHash })
        .onConflictDoNothing();

      // Créer l'utilisateur
      await db
        .insert(appUser)
        .values({
          id: userId,
          name: testUser.username,
          email,
          emailVerified: Math.random() > 0.3,
          image: null,
          role: testUser.role,
          status: testUser.status,
          lastSeen,
          ipAddress: randomIP(),
          geo: randomGeo(),
          createdAt,
          updatedAt: now,
        })
        .onConflictDoNothing();

      createdUserIds.push(userId);
      console.log(
        `✅ ${testUser.role === 'admin' ? '👑' : '👤'} ${testUser.username} (${testUser.role}) - Status: ${testUser.status}`
      );
    } catch (error) {
      console.error(`❌ Erreur pour ${testUser.username}:`, error);
    }
  }

  return createdUserIds;
}

// ============================================================================
// Génération des chats
// ============================================================================

async function seedChats(userIds: string[]) {
  console.log('\n💬 Création des conversations (chats)...\n');

  const chatTitles = [
    'Recherche IA avancée',
    'Classification douanière',
    'Analyse de documents PDF',
    'Nomenclature tarifaire',
    'Questions sur les taxes',
    'Import/Export réglementations',
    'Calcul de droits de douane',
    'Conversion de devises',
    'Statistiques commerciales',
    'Certificats d\'origine',
    'Codes HS automatiques',
    'Correction de libellés',
    'Recherche produits',
    'Veille tarifaire',
    'Optimisation fiscale',
    'Accords commerciaux',
    'Conformité douanière',
    'Documentation import',
    'Valeur en douane',
    'Transit international',
    'Régimes douaniers',
    'Classement tarifaire',
    'Analyse réglementaire',
    'Support technique',
    'Formation utilisateurs',
  ];

  const createdChatIds: string[] = [];
  const activeUserIds = userIds.filter((id) => !id.includes('henry')); // Exclure deleted user

  for (let i = 0; i < 25; i++) {
    try {
      const chatId = uuidv4();
      const userId = randomElement(activeUserIds);
      const title = randomElement(chatTitles);
      const visibility = Math.random() > 0.2 ? 'private' : 'public';
      const createdAt = randomDate(30);
      const updatedAt = new Date(createdAt.getTime() + randomBetween(1000, 86400000));

      await db.insert(chat).values({
        id: chatId,
        userId,
        title,
        visibility: visibility as any,
        createdAt,
        updatedAt,
      });

      createdChatIds.push(chatId);
      console.log(`✅ Chat "${title}" (${visibility}) - User: ${userId.split(':')[1]}`);
    } catch (error) {
      console.error('❌ Erreur création chat:', error);
    }
  }

  return createdChatIds;
}

// ============================================================================
// Génération des messages
// ============================================================================

async function seedMessages(chatIds: string[]) {
  console.log('\n📨 Création des messages...\n');

  const models = [
    { name: 'google-gemini-3.1-flash-lite-preview', weight: 40 },
    { name: 'google-gemini-1.5-pro', weight: 30 },
    { name: 'google-gemini-1.5-flash', weight: 20 },
    { name: 'gpt-4', weight: 5 },
    { name: 'claude-3-opus', weight: 5 },
  ];

  const userMessages = [
    "Quel est le code HS pour des chaussures en cuir ?",
    "Comment calculer les droits de douane sur l'électronique ?",
    "Analyse ce document PDF pour moi",
    "Quelles sont les réglementations pour importer au Canada ?",
    "Convertis 1000 USD en EUR",
    "Donne-moi les statistiques d'import textile France",
    "Comment corriger ce libellé commercial ?",
    "Quel certificat d'origine pour le Maroc ?",
    "Classification Cyrus pour véhicule automobile",
    "Recherche nomenclature douanière complète",
  ];

  const assistantMessages = [
    "Le code HS pour des chaussures en cuir est généralement 6403. Il s'agit du chapitre 64 qui couvre les chaussures, et 6403 concerne spécifiquement les chaussures avec dessus en cuir naturel.",
    "Pour calculer les droits de douane sur l'électronique, il faut prendre en compte plusieurs éléments : la valeur CIF (coût, assurance, fret), le taux de droits applicable selon le code HS, et les éventuelles taxes additionnelles.",
    "J'ai analysé votre document PDF. Il contient 15 pages de données commerciales. Voici les informations clés extraites...",
    "Pour importer au Canada, vous devez : 1) Obtenir un numéro d'entreprise de l'ARC, 2) Déterminer le classement tarifaire, 3) Calculer les droits et taxes, 4) Préparer les documents requis.",
    "Le taux de change actuel est : 1000 USD = 920.50 EUR (taux indicatif)",
    "Voici les statistiques d'importation textile pour la France sur les 12 derniers mois : volume total de 2.5 milliards EUR, principaux pays d'origine : Chine (45%), Bangladesh (18%), Turquie (12%).",
    "Le libellé commercial a été corrigé selon les standards douaniers. Voici la version optimisée pour la classification.",
    "Pour exporter vers le Maroc, vous aurez besoin d'un certificat d'origine EUR.1 si vous bénéficiez de l'accord d'association UE-Maroc.",
    "Classification Cyrus effectuée : Code SH 8703.23 - Voitures de tourisme avec moteur à piston alternatif, cylindrée > 1500 cm³ et ≤ 3000 cm³",
    "Voici la nomenclature douanière complète pour ce produit, avec tous les niveaux de classification du chapitre à la sous-position.",
  ];

  let totalMessages = 0;
  const targetMessages = randomBetween(150, 200);

  // Distribuer les messages : 70% dans les dernières 24h, 30% entre 24h-7j
  while (totalMessages < targetMessages) {
    const chatId = randomElement(chatIds);

    // Créer une paire user + assistant
    try {
      // 70% des messages dans les dernières 24h pour les KPIs
      const isRecent = Math.random() < 0.7;
      const userCreatedAt = isRecent
        ? new Date(Date.now() - randomBetween(1, 24) * 60 * 60 * 1000) // 1-24h
        : randomDate(7, 24); // 24h-7j
      const userMessageId = generateId();

      await db.insert(message).values({
        id: userMessageId,
        chatId,
        role: 'user',
        parts: [{ type: 'text', text: randomElement(userMessages) }],
        attachments: [],
        createdAt: userCreatedAt,
        model: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        completionTime: null,
      });

      totalMessages++;

      // Message assistant (réponse)
      const assistantCreatedAt = new Date(userCreatedAt.getTime() + randomBetween(1000, 5000));
      const assistantMessageId = generateId();

      // Sélectionner un modèle selon les poids
      const rand = Math.random() * 100;
      let cumulative = 0;
      let selectedModel = models[0].name;
      for (const model of models) {
        cumulative += model.weight;
        if (rand <= cumulative) {
          selectedModel = model.name;
          break;
        }
      }

      const inputTokens = randomBetween(200, 2000);
      const outputTokens = randomBetween(100, 1500);
      const totalTokens = inputTokens + outputTokens;
      const completionTime = randomBetween(1000, 5000) / 1000; // 1-5 secondes

      await db.insert(message).values({
        id: assistantMessageId,
        chatId,
        role: 'assistant',
        parts: [{ type: 'text', text: randomElement(assistantMessages) }],
        attachments: [],
        createdAt: assistantCreatedAt,
        model: selectedModel,
        inputTokens,
        outputTokens,
        totalTokens,
        completionTime,
      });

      totalMessages++;

      if (totalMessages % 20 === 0) {
        console.log(`✅ ${totalMessages}/${targetMessages} messages créés...`);
      }
    } catch (error) {
      console.error('❌ Erreur création message:', error);
    }
  }

  console.log(`\n✅ Total de ${totalMessages} messages créés`);
  return totalMessages;
}

// ============================================================================
// Génération des événements système
// ============================================================================

async function seedEvents(userIds: string[]) {
  console.log('\n🔔 Création des événements système...\n');

  const eventTemplates = [
    {
      category: 'security' as const,
      type: 'login',
      messageTemplate: (username: string, ip: string) => `User ${username} logged in from ${ip}`,
    },
    {
      category: 'security' as const,
      type: 'logout',
      messageTemplate: (username: string) => `User ${username} logged out`,
    },
    {
      category: 'security' as const,
      type: 'failed_login',
      messageTemplate: (username: string, ip: string) => `Failed login attempt for ${username} from ${ip}`,
    },
    {
      category: 'user' as const,
      type: 'user_created',
      messageTemplate: (username: string) => `New user account created: ${username}`,
    },
    {
      category: 'user' as const,
      type: 'user_updated',
      messageTemplate: (username: string) => `User ${username} updated their profile`,
    },
    {
      category: 'user' as const,
      type: 'user_suspended',
      messageTemplate: (username: string) => `User ${username} has been suspended`,
    },
    {
      category: 'user' as const,
      type: 'password_reset',
      messageTemplate: (username: string) => `Password reset requested by ${username}`,
    },
    {
      category: 'system' as const,
      type: 'database_backup',
      messageTemplate: () => 'Automated database backup completed',
    },
    {
      category: 'system' as const,
      type: 'api_error',
      messageTemplate: () => 'API rate limit exceeded',
    },
    {
      category: 'system' as const,
      type: 'maintenance',
      messageTemplate: () => 'System maintenance scheduled',
    },
  ];

  const totalEvents = randomBetween(30, 50);

  for (let i = 0; i < totalEvents; i++) {
    try {
      const eventId = generateId();
      const template = randomElement(eventTemplates);
      const userId = Math.random() > 0.3 ? randomElement(userIds) : null;
      const username = userId ? userId.split(':')[1] : 'system';
      const ip = randomIP();

      const eventMessage = template.messageTemplate(username, ip);
      const createdAt = randomDate(7);

      const metadata = {
        ip: template.category === 'security' ? ip : undefined,
        userAgent: template.category === 'security' ? 'Mozilla/5.0 (compatible)' : undefined,
        timestamp: createdAt.toISOString(),
        source: 'seed-script',
      };

      await db.insert(event).values({
        id: eventId,
        category: template.category,
        type: template.type,
        message: eventMessage,
        metadata,
        userId,
        createdAt,
      });

      console.log(`✅ [${template.category}] ${template.type} - ${eventMessage.substring(0, 50)}...`);
    } catch (error) {
      console.error('❌ Erreur création événement:', error);
    }
  }

  console.log(`\n✅ Total de ${totalEvents} événements créés`);
  return totalEvents;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  🎲 Génération de Données de Test - HyperFix Admin  ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  console.log('\n⚠️  Cette opération va créer des données de test dans la base.');
  console.log('   Les données existantes ne seront pas supprimées.\n');

  try {
    // 1. Créer les utilisateurs de test
    const userIds = await seedTestUsers();

    // 2. Créer les chats
    const chatIds = await seedChats(userIds);

    // 3. Créer les messages
    const messageCount = await seedMessages(chatIds);

    // 4. Créer les événements
    const eventCount = await seedEvents(userIds);

    // Rapport final
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║                  📊 RAPPORT FINAL                    ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    console.log(`✅ Utilisateurs créés : ${userIds.length}`);
    console.log(`✅ Conversations créées : ${chatIds.length}`);
    console.log(`✅ Messages créés : ${messageCount}`);
    console.log(`✅ Événements créés : ${eventCount}`);

    console.log('\n📈 Impact sur le Dashboard :');
    console.log('• KPIs affichent des données réelles');
    console.log('• Graphiques avec top 15 des modèles AI');
    console.log('• Liste d\'utilisateurs remplie');
    console.log('• Historique d\'événements disponible');
    console.log('• Statistiques d\'utilisation calculables');

    console.log('\n💡 Prochaines étapes :');
    console.log('1. Démarrer l\'application : pnpm dev');
    console.log('2. Se connecter avec sam/sam');
    console.log('3. Accéder au dashboard : http://localhost:3000/admin');
    console.log('4. Vérifier que tous les graphiques affichent des données');

    console.log('\n✨ Génération de données terminée avec succès !\n');
  } catch (error) {
    console.error('\n❌ Erreur lors de la génération des données:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n❌ Erreur fatale:', e);
    process.exit(1);
  });
