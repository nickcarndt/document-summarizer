'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import ProcessingSteps from '@/components/ProcessingSteps';
import SideBySide from '@/components/SideBySide';
import SummarySkeleton from '@/components/SummarySkeleton';

type ProcessingStep = {
  label: string;
  status: 'pending' | 'processing' | 'complete';
};

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.docId as string;
  const [filename, setFilename] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { label: 'Extracting text...', status: 'complete' },
    { label: 'Chunking document...', status: 'pending' },
    { label: 'Generating embeddings...', status: 'pending' },
    { label: 'Generating summaries...', status: 'pending' },
  ]);
  const [summaries, setSummaries] = useState<{
    claude: { id: string; content: string; latencyMs: number };
    openai: { id: string; content: string; latencyMs: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, check if document exists and get filename
      // For now, we'll start processing immediately
      // In a full implementation, you'd fetch existing summaries from the API

      // Step 1: Embed document
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

      // Step 2: Generate summaries
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // First fetch document info
    const fetchDocumentInfo = async () => {
      try {
        const response = await fetch(`/api/document/${docId}`);
        if (response.ok) {
          const data = await response.json();
          setFilename(data.filename);
        }
      } catch (error) {
        console.error('Failed to fetch document:', error);
      }
    };
    
    fetchDocumentInfo();
    // Then start processing
    loadDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  if (loading && !summaries) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <button
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-white mb-4 inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Upload
            </button>
            <h1 className="text-3xl font-bold">Document Summary</h1>
            {filename && (
              <p className="text-gray-400 mt-2">Document: {filename}</p>
            )}
          </div>

          <ProcessingSteps steps={steps} />

          {error && (
            <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-md text-red-200">
              {error}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-white mb-4 inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Upload
          </button>
          <h1 className="text-3xl font-bold">Document Summary</h1>
          {filename && (
            <p className="text-gray-400 mt-2">Document: {filename}</p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-md text-red-200">
            {error}
          </div>
        )}

        {!summaries && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SummarySkeleton />
            <SummarySkeleton />
          </div>
        )}

        {summaries && (
          <div className="space-y-6">
            <SideBySide
              claude={summaries.claude}
              openai={summaries.openai}
              referenceType="summary"
              referenceId={docId}
            />
            
            <div className="flex justify-center">
              <button
                onClick={() => router.push(`/document/${docId}/qa`)}
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

