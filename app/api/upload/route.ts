import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/db/schema';
import { extractTextFromPDF } from '@/lib/pdf';
import { logger } from '@/lib/logger';

// Increase body size limit for this route
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for large file processing

export async function POST(request: NextRequest) {
  try {
    logger.info('PDF upload request received', 'UPLOAD');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    // Check file size (50MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      logger.warn('File too large', 'UPLOAD', { 
        filename: file.name, 
        size: file.size,
        maxSize: MAX_FILE_SIZE 
      });
      return NextResponse.json({ 
        error: `File too large. Maximum size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.` 
      }, { status: 413 });
    }
    
    if (!file) {
      logger.warn('No file provided in upload request', 'UPLOAD');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    logger.debug('File received', 'UPLOAD', { filename: file.name, size: file.size });
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      logger.warn('Invalid file type attempted', 'UPLOAD', { filename: file.name });
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    logger.debug('Extracting text from PDF', 'UPLOAD');
    const textContent = await extractTextFromPDF(buffer);
    
    if (!textContent || textContent.trim().length === 0) {
      logger.warn('Could not extract text from PDF', 'UPLOAD', { filename: file.name });
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 });
    }
    
    logger.info('Saving document to database', 'UPLOAD', { charCount: textContent.length });
    const [document] = await db.insert(documents).values({
      filename: file.name,
      textContent: textContent,
      charCount: textContent.length
    }).returning();
    
    logger.info('Document uploaded successfully', 'UPLOAD', { documentId: document.id, filename: document.filename });
    
    return NextResponse.json({
      documentId: document.id,
      filename: document.filename,
      charCount: document.charCount
    });
    
  } catch (error) {
    logger.error('Upload failed', 'UPLOAD', error);
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
}

