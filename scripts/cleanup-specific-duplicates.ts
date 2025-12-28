/**
 * Cleanup Specific Duplicate Comparisons
 * 
 * Removes the 5 extra duplicates for referenceId c3677737-eed7-4678-be18-ce8bc49397c6
 * Keeps only the oldest one (430a8842-b49a-4caf-9a3d-7269bc5ce02b)
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
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
} catch (error) {}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const sqlClient = neon(process.env.DATABASE_URL);

async function cleanupSpecificDuplicates() {
  try {
    const referenceId = 'c3677737-eed7-4678-be18-ce8bc49397c6';
    const keepId = '430a8842-b49a-4caf-9a3d-7269bc5ce02b';

    console.log('🔍 Checking for specific duplicate comparisons...\n');

    // Get all comparisons for this referenceId
    const allForRef = await sqlClient`
      SELECT id, winner, created_at
      FROM comparisons
      WHERE reference_id = ${referenceId}
      ORDER BY created_at ASC
    `;

    console.log(`📊 Found ${allForRef.length} comparisons for referenceId ${referenceId.substring(0, 36)}...`);
    allForRef.forEach(c => {
      console.log(`  ${c.id.substring(0, 8)}... - ${c.winner.toUpperCase()} - ${new Date(c.created_at).toLocaleString()}`);
    });

    if (allForRef.length <= 1) {
      console.log('\n✅ No duplicates found for this referenceId');
      process.exit(0);
    }

    // Verify the keepId exists
    const keepExists = allForRef.find(c => c.id === keepId);
    if (!keepExists) {
      console.error(`\n❌ Error: Keep ID ${keepId.substring(0, 8)}... not found!`);
      console.log('Available IDs:');
      allForRef.forEach(c => console.log(`  ${c.id}`));
      process.exit(1);
    }

    console.log(`\n🗑️  Deleting ${allForRef.length - 1} duplicates (keeping ${keepId.substring(0, 8)}...)...`);

    // Delete all except the keepId
    const result = await sqlClient`
      DELETE FROM comparisons 
      WHERE reference_id = ${referenceId}
      AND id != ${keepId}
    `;

    console.log('✅ Cleanup complete\n');

    // Verify
    const remaining = await sqlClient`
      SELECT id, winner, created_at
      FROM comparisons
      WHERE reference_id = ${referenceId}
    `;

    console.log(`📊 Remaining comparisons for this referenceId: ${remaining.length}`);
    if (remaining.length > 0) {
      remaining.forEach(c => {
        console.log(`  ${c.id.substring(0, 8)}... - ${c.winner.toUpperCase()} - ${new Date(c.created_at).toLocaleString()}`);
      });
    }

    // Show total comparison count
    const total = await sqlClient`
      SELECT COUNT(*) as count FROM comparisons
    `;
    console.log(`\n📊 Total comparisons in database: ${total[0]?.count || 0}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

cleanupSpecificDuplicates();

