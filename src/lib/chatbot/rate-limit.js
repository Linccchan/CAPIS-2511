const WINDOW_MS = 10 * 60 * 1_000
const MAX_REQUESTS = 30
const MIN_INTERVAL_MS = 0

// Prototype-level protection: this in-memory state is per server instance and
// may reset or differ between instances on serverless deployments.
export function createChatRateLimiter({
  windowMs = WINDOW_MS,
  maxRequests = MAX_REQUESTS,
  minIntervalMs = MIN_INTERVAL_MS,
} = {}) {
  const requestsByUser = new Map()

  return {
    check(userId, now = Date.now()) {
      const recent = (requestsByUser.get(userId) || []).filter(
        (timestamp) => now - timestamp < windowMs
      )
      const lastRequest = recent.at(-1)

      if (lastRequest && now - lastRequest < minIntervalMs) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((minIntervalMs - (now - lastRequest)) / 1_000)
          ),
        }
      }

      if (recent.length >= maxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((windowMs - (now - recent[0])) / 1_000)
          ),
        }
      }

      recent.push(now)
      requestsByUser.set(userId, recent)

      return {
        allowed: true,
        retryAfterSeconds: 0,
      }
    },

    clear() {
      requestsByUser.clear()
    },
  }
}

const globalLimiterKey = Symbol.for('dmc.customerChatRateLimiter.v2')

export const customerChatRateLimiter =
  globalThis[globalLimiterKey] || createChatRateLimiter()

globalThis[globalLimiterKey] = customerChatRateLimiter
