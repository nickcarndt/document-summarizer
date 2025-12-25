'use client';

import { useRouter } from 'next/navigation';
import FileUpload from '@/components/FileUpload';
import Navigation from '@/components/Navigation';

export default function Home() {
  const router = useRouter();

  const handleUploadSuccess = async (docId: string, file: string, charCount: number) => {
    // Redirect to document page immediately after upload
    // The document page will handle embedding and summarization
    router.push(`/document/${docId}`);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Document Summarizer</h1>
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      </main>
    </div>
  );
}

