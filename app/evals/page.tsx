'use client';

import Navigation from '@/components/Navigation';
import EvalDashboard from '@/components/EvalDashboard';

export default function EvalsPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Evaluation Dashboard</h1>
        <EvalDashboard />
      </main>
    </div>
  );
}

