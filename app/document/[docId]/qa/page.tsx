'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import QAChat from '@/components/QAChat';

export default function DocumentQAPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.docId as string;
  const [filename, setFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await fetch(`/api/document/${docId}`);
        if (response.ok) {
          const data = await response.json();
          setFilename(data.filename);
        }
      } catch (error) {
        console.error('Failed to fetch document:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDocument();
  }, [docId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
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
            onClick={() => router.push(`/document/${docId}`)}
            className="text-gray-400 hover:text-white mb-4 inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Summary
          </button>
          <h1 className="text-3xl font-bold">Document Q&A</h1>
          {filename && (
            <p className="text-gray-400 mt-2">Document: {filename}</p>
          )}
        </div>

        <QAChat documentId={docId} />
      </main>
    </div>
  );
}

