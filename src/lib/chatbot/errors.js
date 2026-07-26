export class ChatbotAuthError extends Error {
  constructor(message = 'Authentication required.') {
    super(message)
    this.name = 'ChatbotAuthError'
  }
}

export class ChatbotForbiddenError extends Error {
  constructor(message = 'Customer access required.') {
    super(message)
    this.name = 'ChatbotForbiddenError'
  }
}

export class ChatbotNotFoundError extends Error {
  constructor(message = 'Order not found.') {
    super(message)
    this.name = 'ChatbotNotFoundError'
  }
}

export class ChatbotDataError extends Error {
  constructor(operation) {
    super(`Chatbot data operation failed: ${operation}`)
    this.name = 'ChatbotDataError'
    this.operation = operation
  }
}

export class GeminiUnavailableError extends Error {
  constructor(code = 'unavailable') {
    super('Gemini service is unavailable.')
    this.name = 'GeminiUnavailableError'
    this.code = code
  }
}
