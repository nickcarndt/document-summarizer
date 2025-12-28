/**
 * Cleanup Duplicate Comparisons in Production
 * 
 * Removes duplicate comparisons, keeping only the latest per referenceId
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

async function cleanupDuplicates() {
  try {
    console.log('🔍 Checking for duplicate comparisons...\n');

    // Get count before
    const before = await sqlClient`
      SELECT COUNT(*) as count FROM comparisons
    `;
    const beforeCount = Number(before[0]?.count || 0);
    console.log(`📊 Before: ${beforeCount} comparisons`);

    // Find duplicates
    const duplicates = await sqlClient`
      SELECT reference_id, COUNT(*) as count
      FROM comparisons
      GROUP BY reference_id
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length > 0) {
      console.log(`\n⚠️  Found ${duplicates.length} reference IDs with duplicates:`);
      duplicates.forEach(d => {
        console.log(`  ${d.reference_id.substring(0, 36)}... has ${d.count} entries`);
      });

      console.log('\n🗑️  Deleting duplicates (keeping latest per referenceId)...');
      
      // Delete duplicates, keeping only the latest
      const result = await sqlClient`
        DELETE FROM comparisons 
        WHERE id NOT IN (
          SELECT DISTINCT ON (reference_id) id 
          FROM comparisons 
          ORDER BY reference_id, created_at DESC
        )
      `;
      
      console.log('✅ Cleanup complete\n');
    } else {
      console.log('✅ No duplicates found\n');
    }

    // Get count after
    const after = await sqlClient`
      SELECT COUNT(*) as count FROM comparisons
    `;
    const afterCount = Number(after[0]?.count || 0);
    console.log(`📊 After: ${afterCount} comparisons`);
    console.log(`📊 Removed: ${beforeCount - afterCount} duplicates`);

    // Show breakdown
    const breakdown = await sqlClient`
      SELECT winner, COUNT(*) as count
      FROM comparisons
      GROUP BY winner
    `;
    console.log('\n📊 Breakdown:');
    breakdown.forEach(b => {
      console.log(`  ${b.winner.toUpperCase()}: ${b.count}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

cleanupDuplicates();

