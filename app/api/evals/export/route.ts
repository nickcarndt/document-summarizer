import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, queries, summaries, feedback, comparisons } from '@/db/schema';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    logger.info('Exporting eval data to CSV', 'EVALS_EXPORT');
    
    // Fetch all data
    const allDocuments = await db.select().from(documents);
    const allQueries = await db.select().from(queries);
    const allSummaries = await db.select().from(summaries);
    const allFeedback = await db.select().from(feedback);
    const allComparisons = await db.select().from(comparisons);
    
    // Build CSV content
    const csvRows: string[] = [];
    
    // CSV Header
    csvRows.push('=== DOCUMENTS ===');
    csvRows.push('id,filename,charCount,chunkCount,createdAt');
    allDocuments.forEach(doc => {
      csvRows.push([
        doc.id,
        `"${doc.filename.replace(/"/g, '""')}"`,
        doc.charCount,
        doc.chunkCount || '',
        doc.createdAt.toISOString()
      ].join(','));
    });
    
    csvRows.push('');
    csvRows.push('=== SUMMARIES ===');
    csvRows.push('id,documentId,model,contentLength,latencyMs,inputTokens,outputTokens,createdAt');
    allSummaries.forEach(summary => {
      csvRows.push([
        summary.id,
        summary.documentId,
        summary.model,
        summary.content.length,
        summary.latencyMs,
        summary.inputTokens || '',
        summary.outputTokens || '',
        summary.createdAt.toISOString()
      ].join(','));
    });
    
    csvRows.push('');
    csvRows.push('=== QUERIES ===');
    csvRows.push('id,documentId,question,claudeResponseLength,claudeLatencyMs,openaiResponseLength,openaiLatencyMs,createdAt');
    allQueries.forEach(query => {
      csvRows.push([
        query.id,
        query.documentId,
        `"${query.question.replace(/"/g, '""')}"`,
        query.claudeResponse.length,
        query.claudeLatencyMs,
        query.openaiResponse.length,
        query.openaiLatencyMs,
        query.createdAt.toISOString()
      ].join(','));
    });
    
    csvRows.push('');
    csvRows.push('=== FEEDBACK ===');
    csvRows.push('id,referenceType,referenceId,model,rating,createdAt');
    allFeedback.forEach(fb => {
      csvRows.push([
        fb.id,
        fb.referenceType,
        fb.referenceId,
        fb.model,
        fb.rating,
        fb.createdAt.toISOString()
      ].join(','));
    });
    
    csvRows.push('');
    csvRows.push('=== COMPARISONS ===');
    csvRows.push('id,referenceType,referenceId,winner,createdAt');
    allComparisons.forEach(comp => {
      csvRows.push([
        comp.id,
        comp.referenceType,
        comp.referenceId,
        comp.winner,
        comp.createdAt.toISOString()
      ].join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="eval-data-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
    
  } catch (error) {
    logger.error('Eval data export failed', 'EVALS_EXPORT', error);
    return NextResponse.json({ error: 'Failed to export eval data' }, { status: 500 });
  }
}

