import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/db/schema';
import { extractTextFromPDF } from '@/lib/pdf';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const textContent = await extractTextFromPDF(buffer);
    
    if (!textContent || textContent.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 });
    }
    
    const [document] = await db.insert(documents).values({
      filename: file.name,
      textContent: textContent,
      charCount: textContent.length
    }).returning();
    
    return NextResponse.json({
      documentId: document.id,
      filename: document.filename,
      charCount: document.charCount
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
}

