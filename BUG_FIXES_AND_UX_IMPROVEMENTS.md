# Bug Fixes & UX Improvements

## Critical Bugs to Fix

### Bug 1: Markdown Not Rendering

The response content shows raw markdown (e.g., `**Summary**` instead of **Summary**).

**Fix:** Install and use react-markdown to render the LLM responses.
```bash
npm install react-markdown
```

In any component that displays Claude or OpenAI response content, replace:
```tsx
// Before
<p>{content}</p>

// After
import ReactMarkdown from 'react-markdown';
<ReactMarkdown className="prose prose-invert prose-sm max-w-none">{content}</ReactMarkdown>
```

Add these Tailwind typography styles. Install if needed:
```bash
npm install @tailwindcss/typography
```

In `tailwind.config.ts`, add the plugin:
```ts
plugins: [require('@tailwindcss/typography')],
```

Apply to both summary cards and Q&A response cards.

---

### Bug 2: Navigation Loses Document State

Going to Eval Dashboard and back to Document Summarizer loses the uploaded document.

**Fix:** Store document state in URL or localStorage.

Option A (URL-based - preferred):
After document upload and embedding, redirect to `/document/[docId]` instead of staying on home page. Structure:
- `/` - Upload page only
- `/document/[docId]` - Shows summary for that document
- `/document/[docId]/qa` - Q&A for that document (rename from `/qa/[docId]`)
- `/evals` - Dashboard

Create these new routes:
- `app/document/[docId]/page.tsx` - Summary view
- `app/document/[docId]/qa/page.tsx` - Q&A view

Update navigation to preserve document context.

Option B (localStorage - simpler):
Store `currentDocumentId` in localStorage after upload. On Document Summarizer page load, check localStorage and restore state if document exists.
```tsx
// After successful upload
localStorage.setItem('currentDocumentId', documentId);

// On page load
useEffect(() => {
  const savedDocId = localStorage.getItem('currentDocumentId');
  if (savedDocId) {
    // Fetch and display existing document/summary
  }
}, []);
```

**Implement Option A** - it's cleaner and allows sharing links.

---

### Bug 3: Eval Dashboard Not Showing Latency

The latency shows 0.0s even though queries have latency data.

**Debug steps:**
1. Check the `/api/evals` endpoint - add console.log to see what data is returned
2. Check the `queries` table in Neon - verify `claude_latency_ms` and `openai_latency_ms` are populated
3. Check the dashboard component - verify it's reading the correct field names

**Likely issue:** The latency is being calculated from the `queries` table but summaries also have latency. Update `/api/evals/route.ts`:
```typescript
// Get latencies from BOTH summaries and queries
const allSummaries = await db.select().from(summaries);
const allQueries = await db.select().from(queries);

// Summary latencies
const claudeSummaryLatencies = allSummaries
  .filter(s => s.model === 'claude')
  .map(s => s.latencyMs);
const openaiSummaryLatencies = allSummaries
  .filter(s => s.model === 'openai')
  .map(s => s.latencyMs);

// Query latencies
const claudeQueryLatencies = allQueries.map(q => q.claudeLatencyMs);
const openaiQueryLatencies = allQueries.map(q => q.openaiLatencyMs);

// Combine all latencies
const allClaudeLatencies = [...claudeSummaryLatencies, ...claudeQueryLatencies];
const allOpenaiLatencies = [...openaiSummaryLatencies, ...openaiQueryLatencies];

const avgClaudeLatency = allClaudeLatencies.length 
  ? allClaudeLatencies.reduce((a, b) => a + b, 0) / allClaudeLatencies.length 
  : 0;
const avgOpenaiLatency = allOpenaiLatencies.length 
  ? allOpenaiLatencies.reduce((a, b) => a + b, 0) / allOpenaiLatencies.length 
  : 0;
```

---

### Bug 4: No Visual Feedback on Comparison Buttons

When clicking "Claude is better" / "Tie" / "OpenAI is better", there's no indication the vote was recorded.

**Fix:** Add selected state and visual feedback.
```tsx
// In CompareButtons.tsx or wherever these buttons are

const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);

const handleCompare = async (winner: 'claude' | 'openai' | 'tie') => {
  setIsSubmitting(true);
  try {
    await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenceType, referenceId, winner })
    });
    setSelectedWinner(winner);
  } catch (error) {
    console.error('Failed to save comparison:', error);
  } finally {
    setIsSubmitting(false);
  }
};

// Button styling
<button
  onClick={() => handleCompare('claude')}
  disabled={isSubmitting || selectedWinner !== null}
  className={`px-4 py-2 rounded-md transition-all ${
    selectedWinner === 'claude'
      ? 'bg-orange-600 ring-2 ring-orange-400 ring-offset-2 ring-offset-gray-900'
      : selectedWinner !== null
      ? 'bg-gray-600 opacity-50 cursor-not-allowed'
      : 'bg-orange-500 hover:bg-orange-600'
  }`}
>
  {selectedWinner === 'claude' ? '✓ Claude Selected' : 'Claude is better'}
</button>

// Same pattern for 'tie' and 'openai' buttons
```

Also show a toast or inline message: "Vote recorded!" after successful submission.

---

### Bug 5: No Visual Feedback on Thumbs Up/Down

Same issue - clicking thumbs up/down shows no feedback.

**Fix:** Add selected state to feedback buttons.
```tsx
// In FeedbackButtons.tsx or SummaryCard.tsx

const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);

const handleFeedback = async (rating: 'up' | 'down') => {
  if (feedback !== null) return; // Already voted
  
  setIsSubmitting(true);
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenceType, referenceId, model, rating })
    });
    setFeedback(rating);
  } catch (error) {
    console.error('Failed to save feedback:', error);
  } finally {
    setIsSubmitting(false);
  }
};

// Thumbs Up button
<button
  onClick={() => handleFeedback('up')}
  disabled={isSubmitting || feedback !== null}
  className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-all ${
    feedback === 'up'
      ? 'bg-green-600 text-white'
      : feedback === 'down'
      ? 'bg-gray-700 opacity-50 cursor-not-allowed'
      : 'bg-gray-700 hover:bg-gray-600'
  }`}
>
  <ThumbsUpIcon className="w-4 h-4" />
  {feedback === 'up' ? 'Voted!' : 'Thumbs Up'}
</button>

// Thumbs Down button - same pattern with 'down' check
```

---

## UI Polish

### 1. Add Loading States

Show skeleton loaders or spinners while:
- Uploading PDF
- Generating embeddings
- Generating summaries
- Processing Q&A
```tsx
// Skeleton for summary card
const SummarySkeleton = () => (
  <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
    <div className="h-6 bg-gray-700 rounded w-24 mb-4"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-700 rounded w-full"></div>
      <div className="h-4 bg-gray-700 rounded w-5/6"></div>
      <div className="h-4 bg-gray-700 rounded w-4/6"></div>
    </div>
  </div>
);
```

### 2. Format Latency Nicely

Currently shows "16.0s" - make it cleaner:
```tsx
const formatLatency = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// Use in latency badge
<span className="text-xs bg-gray-700 px-2 py-1 rounded">
  {formatLatency(latencyMs)}
</span>
```

### 3. Add Success Toast/Notification

Install a toast library:
```bash
npm install react-hot-toast
```

In layout.tsx:
```tsx
import { Toaster } from 'react-hot-toast';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Toaster position="bottom-right" />
        {children}
      </body>
    </html>
  );
}
```

Use in components:
```tsx
import toast from 'react-hot-toast';

// After successful vote
toast.success('Vote recorded!');

// After error
toast.error('Failed to save. Please try again.');
```

### 4. Improve Empty State on Eval Dashboard

Instead of just "No comparisons yet", make it more helpful:
```tsx
{recentComparisons.length === 0 ? (
  <div className="text-center py-8 text-gray-400">
    <p className="mb-2">No comparisons yet</p>
    <p className="text-sm">Upload a document and vote on responses to see data here</p>
  </div>
) : (
  // ... show comparisons
)}
```

### 5. Add Document Name to Q&A Page

The Q&A page should show which document is being queried:
```tsx
// Fetch document info and display at top
<div className="mb-6">
  <p className="text-gray-400 text-sm">Querying document:</p>
  <p className="text-white font-medium">{document.filename}</p>
</div>
```

---

## Debug Logging (Temporary)

Add these logs to debug the eval dashboard issue:

In `/api/evals/route.ts`:
```typescript
console.log('[EVALS] Summaries found:', allSummaries.length);
console.log('[EVALS] Queries found:', allQueries.length);
console.log('[EVALS] Comparisons found:', comparisonResults.length);
console.log('[EVALS] Claude latencies:', allClaudeLatencies);
console.log('[EVALS] OpenAI latencies:', allOpenaiLatencies);
```

In `/api/compare/route.ts`:
```typescript
console.log('[COMPARE] Saving comparison:', { referenceType, referenceId, winner });
console.log('[COMPARE] Saved record:', record);
```

In `/api/feedback/route.ts`:
```typescript
console.log('[FEEDBACK] Saving feedback:', { referenceType, referenceId, model, rating });
console.log('[FEEDBACK] Saved record:', record);
```

Check Vercel logs or terminal to verify data is being saved correctly.

---

## Summary of Changes Needed

1. ✅ Install react-markdown and @tailwindcss/typography
2. ✅ Wrap all LLM response content in ReactMarkdown
3. ✅ Restructure routes: `/` → `/document/[docId]` → `/document/[docId]/qa`
4. ✅ Fix latency calculation in /api/evals to include summaries
5. ✅ Add selected state + visual feedback to comparison buttons
6. ✅ Add selected state + visual feedback to thumbs up/down buttons
7. ✅ Add toast notifications for user actions
8. ✅ Add loading skeletons
9. ✅ Improve empty states
10. ✅ Add debug logging (remove before production)

After implementing all fixes, run `npm run build` and verify no errors.

