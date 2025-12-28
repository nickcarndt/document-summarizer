/**
 * Find All Duplicate Comparisons
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

async function findDuplicates() {
  try {
    console.log('🔍 Finding all duplicate comparisons...\n');

    // Get all comparisons grouped by reference_id
    const allComparisons = await sqlClient`
      SELECT id, reference_id, reference_type, winner, created_at
      FROM comparisons
      ORDER BY reference_id, created_at DESC
    `;

    // Group by reference_id
    const grouped = new Map();
    allComparisons.forEach(c => {
      if (!grouped.has(c.reference_id)) {
        grouped.set(c.reference_id, []);
      }
      grouped.get(c.reference_id).push(c);
    });

    // Find duplicates
    const duplicates: any[] = [];
    grouped.forEach((comparisons, refId) => {
      if (comparisons.length > 1) {
        duplicates.push({ referenceId: refId, count: comparisons.length, comparisons });
      }
    });

    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} reference IDs with duplicates:\n`);
      duplicates.forEach((dup, i) => {
        console.log(`${i + 1}. Reference ID: ${dup.referenceId.substring(0, 36)}...`);
        console.log(`   Count: ${dup.count} comparisons`);
        dup.comparisons.forEach((c: any, j: number) => {
          const date = new Date(c.created_at).toLocaleString();
          console.log(`   ${j + 1}. ${c.winner.toUpperCase()} - ${date} (ID: ${c.id.substring(0, 8)}...)`);
        });
        console.log('');
      });

      // Generate delete SQL
      console.log('🗑️  SQL to delete duplicates (keeping latest):\n');
      duplicates.forEach(dup => {
        const keepId = dup.comparisons[0].id; // Latest one
        const deleteIds = dup.comparisons.slice(1).map((c: any) => c.id);
        console.log(`-- Reference: ${dup.referenceId.substring(0, 36)}...`);
        console.log(`DELETE FROM comparisons WHERE id IN (${deleteIds.map((id: string) => `'${id}'`).join(', ')});`);
        console.log('');
      });
    } else {
      console.log('✅ No duplicates found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findDuplicates();

