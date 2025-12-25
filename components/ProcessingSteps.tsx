'use client';

interface ProcessingStepsProps {
  steps: {
    label: string;
    status: 'pending' | 'processing' | 'complete';
  }[];
}

export default function ProcessingSteps({ steps }: ProcessingStepsProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Processing Document</h3>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-3">
            {step.status === 'complete' ? (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : step.status === 'processing' ? (
              <div className="flex-shrink-0 w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-600" />
            )}
            <span className={step.status === 'complete' ? 'text-gray-300' : step.status === 'processing' ? 'text-orange-400' : 'text-gray-500'}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

