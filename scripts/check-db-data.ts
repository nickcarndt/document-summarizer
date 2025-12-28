/**
 * Check Database Data Script
 * 
 * This script queries the database to see what data actually exists
 * and compares it to what the dashboard is showing.
 * 
 * Run with: npx tsx scripts/check-db-data.ts
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
  // .env.local might not exist, that's okay if DATABASE_URL is set another way
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sqlClient = neon(process.env.DATABASE_URL);

async function checkData() {
  try {
    console.log('🔍 Checking database data...\n');

    // Get all comparisons
    const comparisons = await sqlClient`
      SELECT id, reference_type, reference_id, winner, created_at
      FROM comparisons
      ORDER BY created_at DESC
    `;

    console.log(`📊 Total Comparisons: ${comparisons.length}`);
    console.log('Breakdown:');
    const claudeWins = comparisons.filter(c => c.winner === 'claude').length;
    const openaiWins = comparisons.filter(c => c.winner === 'openai').length;
    const ties = comparisons.filter(c => c.winner === 'tie').length;
    console.log(`  Claude: ${claudeWins}`);
    console.log(`  OpenAI: ${openaiWins}`);
    console.log(`  Tie: ${ties}\n`);

    console.log('Recent comparisons (last 10):');
    comparisons.slice(0, 10).forEach((c, i) => {
      const date = new Date(c.created_at).toLocaleString();
      console.log(`  ${i + 1}. ${c.winner.toUpperCase()} - ${c.reference_type} - ${date}`);
    });

    // Get all queries
    const queries = await sqlClient`
      SELECT id, document_id, question, created_at
      FROM queries
      ORDER BY created_at DESC
    `;

    console.log(`\n📊 Total Queries: ${queries.length}`);
    if (queries.length > 0) {
      console.log('Recent queries:');
      queries.slice(0, 5).forEach((q, i) => {
        const date = new Date(q.created_at).toLocaleString();
        const preview = q.question.substring(0, 50) + (q.question.length > 50 ? '...' : '');
        console.log(`  ${i + 1}. "${preview}" - ${date}`);
      });
    }

    // Check for duplicates
    const duplicateComparisons = await sqlClient`
      SELECT reference_id, COUNT(*) as count
      FROM comparisons
      GROUP BY reference_id
      HAVING COUNT(*) > 1
    `;

    if (duplicateComparisons.length > 0) {
      console.log(`\n⚠️  Found ${duplicateComparisons.length} reference IDs with multiple comparisons:`);
      duplicateComparisons.forEach(d => {
        console.log(`  Reference ID: ${d.reference_id} has ${d.count} entries`);
      });
    } else {
      console.log('\n✅ No duplicate comparisons found');
    }

    // Check dates
    const recentComparisons = comparisons.filter(c => {
      const date = new Date(c.created_at);
      return date >= new Date('2025-12-28');
    });

    console.log(`\n📅 Comparisons from 12/28 or later: ${recentComparisons.length}`);
    if (recentComparisons.length > 0) {
      recentComparisons.forEach(c => {
        const date = new Date(c.created_at).toLocaleString();
        console.log(`  ${c.winner.toUpperCase()} - ${date}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

checkData();

