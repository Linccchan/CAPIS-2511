import { NextResponse } from 'next/server'
import { CUSTOMER_PORTAL_FAQ } from '@/lib/chatbot/customer-faq'
import {
  ChatbotAuthError,
  ChatbotDataError,
  ChatbotForbiddenError,
  ChatbotNotFoundError,
  GeminiUnavailableError,
} from '@/lib/chatbot/errors'
import { getDeterministicOrderReply } from '@/lib/chatbot/deterministic-order-replies'
import {
  getCustomerOrderContext,
  getCustomerOrderOptions,
} from '@/lib/chatbot/get-customer-order-context'
import { customerChatRateLimiter } from '@/lib/chatbot/rate-limit'
import {
  DMC_ASSISTANT_SYSTEM_INSTRUCTIONS,
  getDeterministicSafetyReply,
} from '@/lib/chatbot/system-instructions'
import {
  MAX_CHAT_BODY_BYTES,
  parseCustomerChatRequest,
} from '@/lib/chatbot/validation'
import { generateCustomerAssistantReply } from '@/lib/gemini/server'
import { createAuthenticatedServerClient } from '@/lib/supabase/authenticated-server'

export const runtime = 'nodejs'

const TEMPORARY_UNAVAILABLE_MESSAGE =
  'The assistant is temporarily unavailable. You can still view the latest recorded information on your Order Details page.'
const GEMINI_UNAVAILABLE_MESSAGE =
  'Gemini is temporarily unavailable. Please try your question again in a moment.'

function errorResponse(message, status, headers) {
  return NextResponse.json({ error: message }, { status, headers })
}

async function readRequestBody(request) {
  const contentLength = Number(request.headers.get('content-length') || 0)

  if (contentLength > MAX_CHAT_BODY_BYTES) {
    return { oversized: true }
  }

  const rawBody = await request.text()

  if (Buffer.byteLength(rawBody, 'utf8') > MAX_CHAT_BODY_BYTES) {
    return { oversized: true }
  }

  try {
    return { value: JSON.parse(rawBody) }
  } catch {
    return { invalidJson: true }
  }
}

export async function GET(request) {
  try {
    const { supabase, user } = await createAuthenticatedServerClient(request)
    const orders = await getCustomerOrderOptions({ supabase, user })

    return NextResponse.json({ orders })
  } catch (error) {
    if (error instanceof ChatbotAuthError) {
      return errorResponse('Not authenticated.', 401)
    }

    if (error instanceof ChatbotForbiddenError) {
      return errorResponse('Customer access is required.', 403)
    }

    if (error instanceof ChatbotDataError) {
      console.error('Customer chatbot order selection failed.', {
        operation: error.operation,
      })
    }

    return errorResponse(TEMPORARY_UNAVAILABLE_MESSAGE, 500)
  }
}

export async function POST(request) {
  try {
    const body = await readRequestBody(request)

    if (body.oversized || body.invalidJson) {
      return errorResponse('Invalid request.', 400)
    }

    const parsed = parseCustomerChatRequest(body.value)

    if (!parsed.success) {
      return errorResponse('Invalid request.', 400)
    }

    const { supabase, user } = await createAuthenticatedServerClient(request)
    const rateLimit = customerChatRateLimiter.check(user.id)

    if (!rateLimit.allowed) {
      return errorResponse(
        'Please wait before sending another message.',
        429,
        { 'Retry-After': String(rateLimit.retryAfterSeconds) }
      )
    }

    const context = await getCustomerOrderContext({
      supabase,
      user,
      orderId: parsed.data.orderId,
      orderNumber: parsed.data.orderNumber,
      message: parsed.data.message,
      history: parsed.data.history,
    })
    const safetyReply = getDeterministicSafetyReply(parsed.data.message)
    const fallbackReply = getDeterministicOrderReply({
      message: parsed.data.message,
      orderContext: context.orderContext,
      availableOrderNumbers: context.availableOrderNumbers,
    })
    let reply = safetyReply
    let responseSource = safetyReply ? 'safety' : 'gemini'

    if (!reply) {
      try {
        reply = await generateCustomerAssistantReply({
          question: parsed.data.message,
          history: parsed.data.history,
          orderContext: context.orderContext,
          availableOrderNumbers: context.availableOrderNumbers,
          faq: CUSTOMER_PORTAL_FAQ,
          systemInstruction: DMC_ASSISTANT_SYSTEM_INSTRUCTIONS,
        })
      } catch (error) {
        if (error instanceof GeminiUnavailableError && fallbackReply) {
          console.warn('Customer chatbot used its verified-data fallback.', {
            code: error.code || 'provider_unavailable',
          })
          reply = fallbackReply
          responseSource = 'verified_data_fallback'
        } else {
          throw error
        }
      }
    }

    return NextResponse.json({
      reply,
      orderNumber: context.orderContext?.orderNumber || null,
      hasOrderContext: Boolean(context.orderContext),
      availableOrderNumbers: context.availableOrderNumbers,
      responseSource,
    })
  } catch (error) {
    if (error instanceof ChatbotAuthError) {
      return errorResponse('Not authenticated.', 401)
    }

    if (error instanceof ChatbotForbiddenError) {
      return errorResponse('Customer access is required.', 403)
    }

    if (error instanceof ChatbotNotFoundError) {
      return errorResponse('Order not found.', 404)
    }

    if (error instanceof GeminiUnavailableError) {
      console.error('Customer chatbot provider unavailable.', {
        code: error.code || 'provider_unavailable',
      })
      return errorResponse(GEMINI_UNAVAILABLE_MESSAGE, 503)
    }

    if (error instanceof ChatbotDataError) {
      console.error('Customer chatbot data request failed.', {
        operation: error.operation,
      })
      return errorResponse(TEMPORARY_UNAVAILABLE_MESSAGE, 500)
    }

    console.error('Unexpected customer chatbot failure.')
    return errorResponse(TEMPORARY_UNAVAILABLE_MESSAGE, 500)
  }
}
