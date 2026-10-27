// AI 服务：OpenAI 兼容接口（流式，浏览器直连，BYOK 模式与 eflink-pptx 一致）
import { OfficeError } from '@eflink-tech/office-kit';
import OpenAI from 'openai';
import { isAbortError, type AISettings } from './types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SendMessageParams {
  settings: AISettings;
  messages: ChatMessage[];
  onContentChunk?: (chunk: string, fullSoFar: string) => void;
  signal?: AbortSignal;
}

export interface SendMessageResult {
  content: string;
}

export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const { settings, messages, onContentChunk, signal } = params;
  if (!settings.baseUrl || !settings.apiKey || !settings.model) {
    throw new OfficeError('word.ai.notConfigured', 'AI is not configured: baseUrl/apiKey/model missing');
  }

  const client = new OpenAI({
    baseURL: settings.baseUrl,
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
  });

  try {
    const stream = await client.chat.completions.create(
      {
        model: settings.model,
        messages,
        stream: true,
      },
      { signal },
    );

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const piece = delta?.content ?? '';
      if (piece) {
        full += piece;
        onContentChunk?.(piece, full);
      }
    }
    return { content: full };
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw toOfficeError(error);
  }
}

/** 任意异常归一化为可本地化的 OfficeError（code 为 i18n key，message 仅调试用） */
function toOfficeError(error: unknown): OfficeError {
  if (error instanceof OfficeError) return error;
  const status = (error as Error & { status?: number })?.status;
  const debug = error instanceof Error ? error.message : String(error);
  if (status === 401) return new OfficeError('word.ai.invalidApiKey', debug);
  if (status === 429) return new OfficeError('word.ai.rateLimited', debug);
  return new OfficeError('word.ai.requestFailed', debug);
}
