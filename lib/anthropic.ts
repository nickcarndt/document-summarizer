import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

interface GenerateResponse {
  content: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export async function generateWithClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1024
): Promise<GenerateResponse> {
  const start = Date.now();
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });
  
  const latencyMs = Date.now() - start;
  
  return {
    content: response.content[0].type === 'text' ? response.content[0].text : '',
    latencyMs,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens
  };
}

