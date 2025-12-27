'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import FileUpload from '@/components/FileUpload';
import Navigation from '@/components/Navigation';

export default function Home() {
  const router = useRouter();
  const [lastDocumentId, setLastDocumentId] = useState<string | null>(null);
  const [lastDocumentFilename, setLastDocumentFilename] = useState<string | null>(null);

  useEffect(() => {
    // Check for last document in localStorage
    const storedDocId = localStorage.getItem('lastDocumentId');
    const storedFilename = localStorage.getItem('lastDocumentFilename');
    if (storedDocId) {
      setLastDocumentId(storedDocId);
      setLastDocumentFilename(storedFilename);
    }
  }, []);

  const handleUploadSuccess = async (docId: string, filename: string, charCount: number) => {
    // Store in localStorage for convenience
    localStorage.setItem('lastDocumentId', docId);
    localStorage.setItem('lastDocumentFilename', filename);
    
    // Redirect to document page immediately after upload
    // The document page will handle embedding and summarization
    router.push(`/document/${docId}`);
  };

  const handleContinueLastDocument = () => {
    if (lastDocumentId) {
      router.push(`/document/${lastDocumentId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Document Summarizer</h1>
        
        {lastDocumentId && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400 mb-2">Continue with your last document:</p>
            <button
              onClick={handleContinueLastDocument}
              className="text-orange-400 hover:text-orange-300 font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {lastDocumentFilename || `Document ${lastDocumentId.slice(0, 8)}...`}
            </button>
          </div>
        )}
        
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      </main>
    </div>
  );
}

