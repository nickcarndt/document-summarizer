'use client';

export default function SummarySkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-gray-700 rounded w-24"></div>
        <div className="h-5 bg-gray-700 rounded w-16"></div>
      </div>
      <div className="space-y-3 mb-4">
        <div className="h-4 bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-700 rounded w-4/6"></div>
        <div className="h-4 bg-gray-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-700 rounded w-3/6"></div>
      </div>
      <div className="flex gap-2 mt-4">
        <div className="h-9 bg-gray-700 rounded w-24"></div>
        <div className="h-9 bg-gray-700 rounded w-28"></div>
      </div>
    </div>
  );
}

