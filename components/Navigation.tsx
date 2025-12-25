'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link
              href="/"
              className={`inline-flex items-center px-4 py-2 border-b-2 text-sm font-medium transition-colors ${
                pathname === '/' || pathname?.startsWith('/document')
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-gray-300 hover:text-white hover:border-gray-300'
              }`}
            >
              Document Summarizer
            </Link>
            <Link
              href="/evals"
              className={`inline-flex items-center px-4 py-2 border-b-2 text-sm font-medium transition-colors ${
                pathname === '/evals'
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-gray-300 hover:text-white hover:border-gray-300'
              }`}
            >
              Eval Dashboard
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

