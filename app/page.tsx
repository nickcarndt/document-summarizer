'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '@/components/FileUpload';
import ProcessingSteps from '@/components/ProcessingSteps';
import SideBySide from '@/components/SideBySide';
import Navigation from '@/components/Navigation';

type ProcessingStep = {
  label: string;
  status: 'pending' | 'processing' | 'complete';
};

export default function Home() {
  const router = useRouter();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { label: 'Extracting text...', status: 'pending' },
    { label: 'Chunking document...', status: 'pending' },
    { label: 'Generating embeddings...', status: 'pending' },
    { label: 'Generating summaries...', status: 'pending' },
  ]);
  const [summaries, setSummaries] = useState<{
    claude: { id: string; content: string; latencyMs: number };
    openai: { id: string; content: string; latencyMs: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUploadSuccess = async (docId: string, file: string, charCount: number) => {
    setDocumentId(docId);
    setFilename(file);
    setError(null);

    // Step 1: Text extraction (already done)
    setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'complete' } : s));

    try {
      // Step 2: Embed document
      setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'processing' } : s));
      
      const embedResponse = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      });

      if (!embedResponse.ok) {
        const data = await embedResponse.json();
        throw new Error(data.error || 'Failed to embed document');
      }

      setSteps(prev => prev.map((s, i) => 
        i === 1 ? { ...s, status: 'complete' } : 
        i === 2 ? { ...s, status: 'processing' } : s
      ));

      // Embedding is done as part of embed step
      setSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'complete' } : s));

      // Step 3: Generate summaries
      setSteps(prev => prev.map((s, i) => i === 3 ? { ...s, status: 'processing' } : s));

      const summarizeResponse = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      });

      if (!summarizeResponse.ok) {
        const data = await summarizeResponse.json();
        throw new Error(data.error || 'Failed to generate summaries');
      }

      const summaryData = await summarizeResponse.json();
      setSummaries(summaryData);
      setSteps(prev => prev.map((s, i) => i === 3 ? { ...s, status: 'complete' } : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setSteps(prev => prev.map(s => 
        s.status === 'processing' ? { ...s, status: 'pending' } : s
      ));
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Document Summarizer</h1>

        {!documentId && (
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        )}

        {documentId && !summaries && (
          <ProcessingSteps steps={steps} />
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-md text-red-200">
            {error}
          </div>
        )}

        {summaries && documentId && (
          <div className="space-y-6">
            <SideBySide
              claude={summaries.claude}
              openai={summaries.openai}
              referenceType="summary"
              referenceId={documentId}
            />
            
            <div className="flex justify-center">
              <button
                onClick={() => router.push(`/qa/${documentId}`)}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md transition-colors"
              >
                Ask Questions
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

