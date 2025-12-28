'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';

interface TooltipProps {
  text: string;
  children: ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
  const [position, setPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkPosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      // If too close to top, show below
      if (rect.top < 60) {
        setPosition('bottom');
      }
      // If too close to right edge, show on left
      else if (rect.right > window.innerWidth - 150) {
        setPosition('left');
      }
      // If too close to left edge, show on right
      else if (rect.left < 150) {
        setPosition('right');
      }
      else {
        setPosition('top');
      }
    };
    
    checkPosition();
    window.addEventListener('resize', checkPosition);
    return () => window.removeEventListener('resize', checkPosition);
  }, []);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700',
    bottom: 'absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-700',
    left: 'absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-700',
    right: 'absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-700'
  };

  return (
    <div ref={containerRef} className="relative group inline-block">
      {children}
      <div 
        className={`absolute ${positionClasses[position]} px-3 py-2 bg-gray-700 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap`}
      >
        {text}
        <div className={arrowClasses[position]}></div>
      </div>
    </div>
  );
}

export function InfoIcon({ tooltip }: { tooltip: string }) {
  return (
    <Tooltip text={tooltip}>
      <svg 
        className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help inline ml-1" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
    </Tooltip>
  );
}

