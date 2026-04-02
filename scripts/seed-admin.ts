import { db } from '@/lib/db';
import { users as credentials, user as appUser } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface UserCreationResult {
  username: string;
  password: string;
  role: 'admin' | 'user';
  status: 'created' | 'updated' | 'exists';
}

async function verifyDatabaseConnection(): Promise<boolean> {
  console.log('\n🔍 Vérification de la connexion à la base de données...');
  try {
    await db.execute(sql`SELECT 1`);
    console.log('✅ Connexion à PostgreSQL réussie');
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error);
    return false;
  }
}

async function verifyTables(): Promise<boolean> {
  console.log('\n🔍 Vérification des tables...');
  try {
    const tables = ['user', 'users', 'chat', 'message', 'event'];
    const results = await Promise.all(
      tables.map(async (table) => {
        try {
          await db.execute(sql.raw(`SELECT 1 FROM ${table} LIMIT 1`));
          console.log(`✅ Table "${table}" existe`);
          return true;
        } catch {
          console.log(`❌ Table "${table}" manquante`);
          return false;
        }
      })
    );
    return results.every((r) => r);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des tables:', error);
    return false;
  }
}

async function createUser(
  username: string,
  password: string,
  email: string,
  role: 'admin' | 'user'
): Promise<UserCreationResult> {
  const userId = `local:${username}`;
  const now = new Date();

  const mod = await import('bcryptjs');
  const bcrypt = (mod as any).default ?? (mod as any);
  const passwordHash = await bcrypt.hash(password, 10);

  // Vérifier si le credential existe
  const cred = await db.query.users
    .findFirst({ where: eq(credentials.username, username) })
    .catch(() => null);

  if (!cred) {
    await db.insert(credentials).values({ username, passwordHash });
  }

  // Vérifier si l'utilisateur existe
  const existingUser = await db.query.user.findFirst({ where: eq(appUser.id, userId) });

  if (!existingUser) {
    await db.insert(appUser).values({
      id: userId,
      name: username,
      email,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
      role,
      status: 'active',
    } as any);
    return { username, password, role, status: 'created' };
  } else {
    // Mettre à jour si nécessaire
    await db
      .update(appUser)
      .set({ role: role as any, status: 'active' as any, updatedAt: now })
      .where(eq(appUser.id, userId));
    return { username, password, role, status: 'updated' };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║    🚀 Initialisation du Dashboard Admin HyperFix    ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // 1. Vérifications préalables
  const dbConnected = await verifyDatabaseConnection();
  if (!dbConnected) {
    console.error('\n❌ Impossible de continuer sans connexion à la base de données');
    process.exit(1);
  }

  const tablesExist = await verifyTables();
  if (!tablesExist) {
    console.log('\n⚠️  Certaines tables sont manquantes. Exécutez "pnpm db:push" d\'abord');
    process.exit(1);
  }

  console.log('\n📝 Création des utilisateurs...\n');

  const results: UserCreationResult[] = [];

  // 2. Créer l'admin principal (sam/sam)
  try {
    const sam = await createUser('sam', 'sam', 'sam@local', 'admin');
    results.push(sam);
    console.log(`✅ Admin principal "${sam.username}" ${sam.status === 'created' ? 'créé' : 'mis à jour'}`);
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'admin principal:', error);
  }

  // 3. Créer l'admin personnalisé (variables d'environnement)
  try {
    const customAdminUsername = process.env.ADMIN_USERNAME || 'admin';
    const customAdminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const customAdminEmail = process.env.ADMIN_EMAIL || 'admin@hyper.local';

    const customAdmin = await createUser(
      customAdminUsername,
      customAdminPassword,
      customAdminEmail,
      'admin'
    );
    results.push(customAdmin);
    console.log(
      `✅ Admin personnalisé "${customAdmin.username}" ${customAdmin.status === 'created' ? 'créé' : 'mis à jour'}`
    );
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'admin personnalisé:', error);
  }

  // 4. Créer l'utilisateur de démonstration
  try {
    const demo = await createUser('demo', 'demo123', 'demo@hyper.local', 'user');
    results.push(demo);
    console.log(`✅ Utilisateur demo "${demo.username}" ${demo.status === 'created' ? 'créé' : 'mis à jour'}`);
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur demo:', error);
  }

  // 5. Rapport final
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║               📊 RAPPORT D\'INITIALISATION            ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  console.log('\n🔐 Credentials de connexion :\n');

  results.forEach((result) => {
    const icon = result.role === 'admin' ? '👑' : '👤';
    console.log(`${icon} ${result.role.toUpperCase()} - Username: ${result.username} / Password: ${result.password}`);
  });

  console.log('\n📋 Instructions :\n');
  console.log('1. Démarrer l\'application : pnpm dev');
  console.log('2. Aller sur : http://localhost:3000/sign-in');
  console.log('3. Se connecter avec les credentials ci-dessus');
  console.log('4. Accéder au dashboard admin : http://localhost:3000/admin');

  console.log('\n💡 Prochaines étapes :\n');
  console.log('• Générer des données de test : pnpm seed:test-data');
  console.log('• Comptes créés : sam/sam, ' + (process.env.ADMIN_USERNAME || 'admin') + '/' + (process.env.ADMIN_PASSWORD || 'admin123') + ', demo/demo123');
  console.log('• Réinitialiser tout : pnpm seed:reset');
  console.log('• Lire la documentation : SETUP_ADMIN.md');

  console.log('\n✨ Initialisation terminée avec succès !\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n❌ Erreur fatale:', e);
    process.exit(1);
  });
