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
    // Store documentId in localStorage for convenience
    if (docId) {
      localStorage.setItem('lastDocumentId', docId);
    }
    
    const fetchExistingData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Fetch document metadata
        const docResponse = await fetch(`/api/document/${docId}`);
        if (!docResponse.ok) {
          throw new Error('Document not found');
        }
        const docData = await docResponse.json();
        setFilename(docData.filename);
        if (docData.filename) {
          localStorage.setItem('lastDocumentFilename', docData.filename);
        }
        
        // 2. Check if summaries already exist
        const summariesResponse = await fetch(`/api/summaries/${docId}`);
        if (!summariesResponse.ok) {
          throw new Error('Failed to check for existing summaries');
        }
        const summariesData = await summariesResponse.json();
        
        if (summariesData.claude && summariesData.openai) {
          // Summaries exist - display them directly (no pipeline needed)
          setSummaries(summariesData);
          setSteps(prev => prev.map(s => ({ ...s, status: 'complete' })));
          setLoading(false);
        } else {
          // No summaries yet - run the pipeline
          await loadDocument();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
        setLoading(false);
      }
    };
    
    fetchExistingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const handleClearDocument = () => {
    if (confirm('Are you sure you want to start a new document? This will clear your current session.')) {
      localStorage.removeItem('lastDocumentId');
      localStorage.removeItem('lastDocumentFilename');
      router.push('/');
    }
  };

  if (loading && !summaries) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <button
                  onClick={() => router.push('/')}
                  className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Upload
                </button>
                <h1 className="text-2xl font-bold text-white">Document Summary</h1>
                {filename && (
                  <p className="text-gray-400 text-sm mt-1">Document: {filename}</p>
                )}
              </div>
              
              <div className="flex flex-col gap-2 items-end">
                <button
                  onClick={handleClearDocument}
                  className="text-sm text-gray-400 hover:text-white flex items-center gap-1 px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload New
                </button>
              </div>
            </div>
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
          <div className="flex items-start justify-between mb-4">
            <div>
              <button
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Upload
              </button>
              <h1 className="text-2xl font-bold text-white">Document Summary</h1>
              {filename && (
                <p className="text-gray-400 text-sm mt-1">Document: {filename}</p>
              )}
            </div>
            
            <div className="flex flex-col gap-2 items-end">
              <button
                onClick={handleClearDocument}
                className="text-sm text-gray-400 hover:text-white flex items-center gap-1 px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload New
              </button>
              {summaries && (
                <button
                  onClick={() => router.push(`/document/${docId}/qa`)}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Ask Questions
                </button>
              )}
            </div>
          </div>
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
          <div className="space-y-6 animate-fadeIn">
            <SideBySide
              claude={summaries.claude}
              openai={summaries.openai}
              referenceType="summary"
              referenceId={docId}
            />
            <div className="text-xs text-gray-500 text-center">
              Latency: <span className="text-green-400">●</span> &lt;5s 
              <span className="text-yellow-400 ml-2">●</span> 5-15s 
              <span className="text-red-400 ml-2">●</span> &gt;15s
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

