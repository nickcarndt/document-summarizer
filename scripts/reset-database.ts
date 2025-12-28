/**
 * Reset Database for Fair Comparison
 * 
 * Clears all evaluation data (comparisons, feedback, queries, summaries)
 * but keeps documents so users don't have to re-upload.
 * 
 * This ensures all new data uses Claude Haiku vs GPT-4o-mini (fair comparison)
 * instead of mixing with old Claude Sonnet data.
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

async function resetDatabase() {
  try {
    console.log('🔍 Checking current database state...\n');

    // Get counts before
    const [docCount] = await sqlClient`SELECT COUNT(*) as count FROM documents`;
    const [queryCount] = await sqlClient`SELECT COUNT(*) as count FROM queries`;
    const [comparisonCount] = await sqlClient`SELECT COUNT(*) as count FROM comparisons`;
    const [feedbackCount] = await sqlClient`SELECT COUNT(*) as count FROM feedback`;
    const [summaryCount] = await sqlClient`SELECT COUNT(*) as count FROM summaries`;
    const [chunkCount] = await sqlClient`SELECT COUNT(*) as count FROM chunks`;

    console.log('📊 Current database state:');
    console.log(`  Documents: ${docCount?.count || 0}`);
    console.log(`  Summaries: ${summaryCount?.count || 0}`);
    console.log(`  Queries: ${queryCount?.count || 0}`);
    console.log(`  Comparisons: ${comparisonCount?.count || 0}`);
    console.log(`  Feedback: ${feedbackCount?.count || 0}`);
    console.log(`  Chunks: ${chunkCount?.count || 0}`);

    console.log('\n⚠️  This will DELETE:');
    console.log('  - All summaries (will regenerate with Haiku)');
    console.log('  - All queries');
    console.log('  - All comparisons');
    console.log('  - All feedback');
    console.log('  - All chunks (will regenerate with new embeddings)');
    console.log('\n✅ This will KEEP:');
    console.log('  - All documents (so you don\'t have to re-upload)');

    console.log('\n🔄 Starting cleanup...\n');

    // Delete in order (respecting foreign keys)
    console.log('1. Deleting comparisons...');
    await sqlClient`DELETE FROM comparisons`;
    console.log('   ✅ Deleted');

    console.log('2. Deleting feedback...');
    await sqlClient`DELETE FROM feedback`;
    console.log('   ✅ Deleted');

    console.log('3. Deleting queries...');
    await sqlClient`DELETE FROM queries`;
    console.log('   ✅ Deleted');

    console.log('4. Deleting summaries...');
    await sqlClient`DELETE FROM summaries`;
    console.log('   ✅ Deleted');

    console.log('5. Deleting chunks...');
    await sqlClient`DELETE FROM chunks`;
    console.log('   ✅ Deleted');

    // Verify
    const [finalDocCount] = await sqlClient`SELECT COUNT(*) as count FROM documents`;
    const [finalQueryCount] = await sqlClient`SELECT COUNT(*) as count FROM queries`;
    const [finalComparisonCount] = await sqlClient`SELECT COUNT(*) as count FROM comparisons`;
    const [finalFeedbackCount] = await sqlClient`SELECT COUNT(*) as count FROM feedback`;
    const [finalSummaryCount] = await sqlClient`SELECT COUNT(*) as count FROM summaries`;
    const [finalChunkCount] = await sqlClient`SELECT COUNT(*) as count FROM chunks`;

    console.log('\n📊 Final database state:');
    console.log(`  Documents: ${finalDocCount?.count || 0} (kept)`);
    console.log(`  Summaries: ${finalSummaryCount?.count || 0} (cleared)`);
    console.log(`  Queries: ${finalQueryCount?.count || 0} (cleared)`);
    console.log(`  Comparisons: ${finalComparisonCount?.count || 0} (cleared)`);
    console.log(`  Feedback: ${finalFeedbackCount?.count || 0} (cleared)`);
    console.log(`  Chunks: ${finalChunkCount?.count || 0} (cleared)`);

    console.log('\n✅ Database reset complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Visit any existing document page');
    console.log('  2. Summaries will regenerate automatically with Claude Haiku');
    console.log('  3. All new comparisons will be fair (Haiku vs GPT-4o-mini)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

resetDatabase();

