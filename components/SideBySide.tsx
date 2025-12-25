'use client';

import SummaryCard from './SummaryCard';
import CompareButtons from './CompareButtons';

interface SideBySideProps {
  claude: { id: string; content: string; latencyMs: number };
  openai: { id: string; content: string; latencyMs: number };
  referenceType: 'summary' | 'query';
  referenceId: string;
}

export default function SideBySide({ claude, openai, referenceType, referenceId }: SideBySideProps) {
  // For summaries, use summary IDs. For queries, use query ID.
  const claudeRefId = referenceType === 'summary' ? claude.id : referenceId;
  const openaiRefId = referenceType === 'summary' ? openai.id : referenceId;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SummaryCard
          model="claude"
          content={claude.content}
          latencyMs={claude.latencyMs}
          referenceId={claudeRefId}
          referenceType={referenceType}
        />
        <SummaryCard
          model="openai"
          content={openai.content}
          latencyMs={openai.latencyMs}
          referenceId={openaiRefId}
          referenceType={referenceType}
        />
      </div>
      
      <div className="flex justify-center">
        <CompareButtons referenceType={referenceType} referenceId={referenceId} />
      </div>
    </div>
  );
}

