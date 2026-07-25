'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordPage() {
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function savePassword() {
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    alert('Password created successfully.')

    window.location.href = '/'
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '100px auto',
      }}
    >
      <h1>Create Password</h1>

      <input
        className="input"
        type="password"
        placeholder="New Password"
        value={password}
        onChange={(e) =>
          setPassword(e.target.value)
        }
      />

      <button
        className="btn btn-primary"
        style={{
          marginTop: 20,
          width: '100%',
        }}
        disabled={loading}
        onClick={savePassword}
      >
        {loading ? 'Saving...' : 'Create Password'}
      </button>
    </div>
  )
}