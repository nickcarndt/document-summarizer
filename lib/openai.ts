import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

interface GenerateResponse {
  content: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export async function generateWithOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024
): Promise<GenerateResponse> {
  const start = Date.now();
  
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: maxTokens,
    temperature: 0,
    top_p: 1,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });
  
  const latencyMs = Date.now() - start;
  
  return {
    content: response.choices[0].message.content || '',
    latencyMs,
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0
  };
}
