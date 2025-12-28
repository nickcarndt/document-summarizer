/**
 * Cleanup Old Duplicate Data Script
 * 
 * Removes old duplicate comparisons from 12/25 that were created before deduplication fix.
 * 
 * Run with: npx tsx scripts/cleanup-old-duplicates.ts
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local
try {
  const envPath = join(process.cwd(), '.env.local');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  // .env.local might not exist
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sqlClient = neon(process.env.DATABASE_URL);

async function cleanupOldDuplicates() {
  try {
    console.log('🔍 Checking for old duplicate comparisons...\n');

    // Check for comparisons from before 12/26
    const oldComparisons = await sqlClient`
      SELECT id, reference_id, winner, created_at
      FROM comparisons
      WHERE created_at < '2025-12-26'
      ORDER BY created_at DESC
    `;

    console.log(`📊 Found ${oldComparisons.length} comparisons from before 12/26:`);
    oldComparisons.forEach(c => {
      const date = new Date(c.created_at).toLocaleString();
      console.log(`  ${c.winner.toUpperCase()} - ${c.reference_id.substring(0, 8)}... - ${date}`);
    });

    // Check for the specific reference ID mentioned
    const specificRef = await sqlClient`
      SELECT id, reference_id, winner, created_at
      FROM comparisons
      WHERE reference_id = 'c3677737-eed7-4678-be18-ce8bc49397c6'
      AND created_at < '2025-12-26'
      ORDER BY created_at DESC
    `;

    if (specificRef.length > 0) {
      console.log(`\n🗑️  Found ${specificRef.length} old comparisons for reference_id c3677737...`);
      console.log('Deleting...');
      
      const result = await sqlClient`
        DELETE FROM comparisons 
        WHERE reference_id = 'c3677737-eed7-4678-be18-ce8bc49397c6'
        AND created_at < '2025-12-26'
      `;
      
      console.log(`✅ Deleted ${specificRef.length} old comparisons\n`);
    } else {
      console.log('\n✅ No old comparisons found for that reference_id\n');
    }

    // Final count
    const finalCount = await sqlClient`
      SELECT COUNT(*) as count FROM comparisons
    `;
    console.log(`📊 Final comparison count: ${finalCount[0]?.count || 0}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

cleanupOldDuplicates();

