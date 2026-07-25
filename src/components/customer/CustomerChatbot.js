'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { FiMessageCircle, FiSend, FiX } from 'react-icons/fi'
import { supabase } from '@/lib/supabaseClient'

const SUGGESTED_QUESTIONS = [
  'What is the current status of my order?',
  'When is my order expected to be ready?',
  'Has my down payment been confirmed?',
  'Have all supplier deliveries arrived?',
  'What preparation steps are still incomplete?',
  'Has labeling been completed?',
  'Are my shipment documents ready?',
]

const GENERIC_ERROR =
  'The assistant is temporarily unavailable. You can still view the latest recorded information on your Order Details page.'

function messageId(role) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function CustomerChatbot() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orderOptions, setOrderOptions] = useState([])
  const [selectedOrderNumber, setSelectedOrderNumber] = useState('')
  const [loadingOrders, setLoadingOrders] = useState(false)
  const inputRef = useRef(null)
  const messageEndRef = useRef(null)
  const orderId = useMemo(() => {
    const match = pathname.match(
      /^\/customer\/orders\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/i
    )
    return match?.[1]
  }, [pathname])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open || orderId || orderOptions.length > 0) return

    let cancelled = false

    const loadOrders = async () => {
      setLoadingOrders(true)

      try {
        let {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.access_token) return

        let response = await fetch('/api/customer/chat', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (response.status === 401) {
          const { data, error: refreshError } =
            await supabase.auth.refreshSession()

          if (refreshError || !data.session?.access_token) return

          session = data.session
          response = await fetch('/api/customer/chat', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          })
        }

        if (!response.ok) return

        const result = await response.json()
        const orders = Array.isArray(result.orders) ? result.orders : []

        if (!cancelled) {
          setOrderOptions(orders)

          if (orders.length === 1) {
            setSelectedOrderNumber(orders[0].orderNumber)
          }
        }
      } catch {
        // The chat can still handle general portal questions if order loading fails.
      } finally {
        if (!cancelled) setLoadingOrders(false)
      }
    }

    loadOrders()

    return () => {
      cancelled = true
    }
  }, [open, orderId, orderOptions.length])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (suggestedMessage) => {
    const message = (suggestedMessage ?? input).trim()

    if (!message || loading || message.length > 1_000) return

    const customerMessage = {
      id: messageId('user'),
      role: 'user',
      content: message,
    }
    const history = messages
      .slice(-8)
      .map(({ role, content }) => ({ role, content }))

    setMessages((current) => [...current, customerMessage])
    setInput('')
    setError('')
    setLoading(true)

    try {
      const sendWithAccessToken = (accessToken) =>
        fetch('/api/customer/chat', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          message,
          ...(orderId
            ? { orderId }
            : selectedOrderNumber
              ? { orderNumber: selectedOrderNumber }
              : {}),
          history,
        }),
        })

      let {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('No authenticated session')
      }

      let response = await sendWithAccessToken(session.access_token)

      if (response.status === 401) {
        const { data, error: refreshError } =
          await supabase.auth.refreshSession()

        if (refreshError || !data.session?.access_token) {
          throw new Error('No authenticated session')
        }

        session = data.session
        response = await sendWithAccessToken(session.access_token)
      }

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || GENERIC_ERROR)
      }

      if (Array.isArray(result.availableOrderNumbers)) {
        setOrderOptions((current) => {
          if (current.length > 0) return current

          return result.availableOrderNumbers.map((orderNumber) => ({
            orderNumber,
            status: '',
          }))
        })
      }

      if (result.orderNumber) {
        setSelectedOrderNumber(result.orderNumber)
      }

      setMessages((current) => [
        ...current,
        {
          id: messageId('assistant'),
          role: 'assistant',
          content: result.reply,
        },
      ])
    } catch (requestError) {
      setError(
        requestError.message === 'No authenticated session'
          ? 'Please sign in again to use the assistant.'
          : requestError.message || GENERIC_ERROR
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <section
          aria-label="DMC Order Assistant"
          className="fixed inset-x-3 bottom-20 z-50 flex max-h-[min(680px,calc(100vh-6rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:left-auto sm:right-5 sm:w-[410px]"
          role="dialog"
        >
          <header className="flex items-start justify-between border-b border-gray-200 bg-black px-4 py-3 text-white">
            <div>
              <h2 className="text-sm font-semibold">DMC Order Assistant</h2>
              <p className="mt-0.5 max-w-xs text-xs text-gray-300">
                Gemini-powered help for orders, payments, preparation
                progress, and the customer portal.
              </p>
            </div>
            <button
              aria-label="Minimize DMC Order Assistant"
              className="rounded p-1 text-gray-300 hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              <FiX aria-hidden="true" size={18} />
            </button>
          </header>

          {!orderId && (
            <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
              <label
                className="shrink-0 text-xs font-medium text-gray-600"
                htmlFor="dmc-chat-order"
              >
                Order
              </label>
              <select
                className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={loadingOrders || orderOptions.length === 0}
                id="dmc-chat-order"
                onChange={(event) => {
                  setSelectedOrderNumber(event.target.value)
                  setMessages([])
                  setError('')
                }}
                value={selectedOrderNumber}
              >
                <option value="">
                  {loadingOrders
                    ? 'Loading orders…'
                    : orderOptions.length
                      ? 'Select an order'
                      : 'No orders available'}
                </option>
                {orderOptions.map((order) => (
                  <option key={order.orderNumber} value={order.orderNumber}>
                    {order.orderNumber}
                    {order.status ? ` — ${order.status}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4"
          >
            {messages.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-medium text-gray-900">
                  Welcome. How can I help?
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  I provide read-only assistance using the latest
                  customer-visible information recorded for your account.
                  {orderId
                    ? ' This order is selected automatically.'
                    : ' Include an order number when you have more than one order.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-left text-xs text-gray-700 hover:border-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      disabled={
                        loading ||
                        (orderOptions.length > 1 && !selectedOrderNumber)
                      }
                      key={question}
                      onClick={() => sendMessage(question)}
                      type="button"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
                key={message.id}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-5 ${
                    message.role === 'user'
                      ? 'rounded-br-sm bg-black text-white'
                      : 'rounded-bl-sm border border-gray-200 bg-white text-gray-800'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
                  Checking your latest recorded information…
                </div>
              </div>
            )}

            {error && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          <form
            className="border-t border-gray-200 bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault()
              sendMessage()
            }}
          >
            <label className="sr-only" htmlFor="dmc-chat-message">
              Ask DMC Order Assistant
            </label>
            <div className="flex items-end gap-2">
              <textarea
                aria-describedby="dmc-chat-limit"
                className="max-h-28 min-h-10 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={loading}
                id="dmc-chat-message"
                maxLength={1_000}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Ask about an order…"
                ref={inputRef}
                rows={1}
                value={input}
              />
              <button
                aria-label="Send message"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={loading || !input.trim()}
                type="submit"
              >
                <FiSend aria-hidden="true" size={16} />
              </button>
            </div>
            <p className="mt-1 text-right text-[10px] text-gray-400" id="dmc-chat-limit">
              {input.length}/1,000
            </p>
          </form>
        </section>
      )}

      <button
        aria-expanded={open}
        aria-label={open ? 'Minimize DMC Order Assistant' : 'Ask DMC Assistant'}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? <FiX aria-hidden="true" /> : <FiMessageCircle aria-hidden="true" />}
        <span>{open ? 'Close assistant' : 'Ask DMC Assistant'}</span>
      </button>
    </>
  )
}
