import 'server-only'

import { GoogleGenAI } from '@google/genai'
import { GeminiUnavailableError } from '@/lib/chatbot/errors'
import { formatAssistantPlainText } from '@/lib/chatbot/plain-text'
import { getResponseGuidance } from '@/lib/chatbot/system-instructions'

const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview'
const GEMINI_TIMEOUT_MS = 18_000
const GEMINI_ATTEMPTS = 2

export function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
}

export function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()

  if (!apiKey) {
    throw new GeminiUnavailableError('configuration')
  }

  return new GoogleGenAI({ apiKey })
}

export async function generateCustomerAssistantReply({
  question,
  history,
  orderContext,
  availableOrderNumbers,
  faq,
  systemInstruction,
}) {
  const ai = createGeminiClient()
  const safePrompt = {
    task:
      'Answer only the current customer question using the supplied data. Follow responseGuidance closely.',
    responseGuidance: getResponseGuidance(question),
    selectedOrder: orderContext,
    availableOrderNumbers,
    approvedPortalFaq: faq,
    recentConversation: history,
    currentQuestion: question,
  }

  for (let attempt = 1; attempt <= GEMINI_ATTEMPTS; attempt += 1) {
    const abortController = new AbortController()
    const timeout = setTimeout(
      () => abortController.abort(),
      GEMINI_TIMEOUT_MS
    )

    try {
      const response = await ai.models.generateContent({
        model: getGeminiModel(),
        contents: JSON.stringify(safePrompt),
        config: {
          abortSignal: abortController.signal,
          maxOutputTokens: 1_000,
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: 'minimal',
          },
        },
      })

      const reply = formatAssistantPlainText(response.text)

      if (!reply) {
        throw new GeminiUnavailableError('empty_response')
      }

      return reply
    } catch (error) {
      const normalizedError =
        error instanceof GeminiUnavailableError
          ? error
          : error?.name === 'AbortError'
            ? new GeminiUnavailableError('timeout')
            : new GeminiUnavailableError(
                error?.status === 429
                  ? 'provider_rate_limit'
                  : 'provider_error'
              )

      const retryable =
        normalizedError.code !== 'configuration' &&
        normalizedError.code !== 'provider_rate_limit'

      if (attempt === GEMINI_ATTEMPTS || !retryable) {
        throw normalizedError
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new GeminiUnavailableError('provider_error')
}
