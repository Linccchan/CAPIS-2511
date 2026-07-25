import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { ChatbotAuthError, ChatbotDataError } from '@/lib/chatbot/errors'

function readBearerToken(request) {
  const authorization = request.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)

  if (!match?.[1]) {
    throw new ChatbotAuthError()
  }

  return match[1]
}

export async function createAuthenticatedServerClient(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new ChatbotDataError('server configuration')
  }

  const accessToken = readBearerToken(request)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })

  const { data, error } = await supabase.auth.getUser(accessToken)

  if (
    error?.name === 'AuthRetryableFetchError' ||
    (typeof error?.status === 'number' && error.status >= 500)
  ) {
    throw new ChatbotDataError('authentication validation')
  }

  if (error || !data.user) {
    throw new ChatbotAuthError()
  }

  return {
    supabase,
    user: data.user,
  }
}
