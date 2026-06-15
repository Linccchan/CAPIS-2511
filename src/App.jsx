import { useEffect } from 'react'
import { supabase } from './lib/supabaseClient'

function App() {
  useEffect(() => {
    const testConnection = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')

      console.log('Data:', data)
      console.log('Error:', error)
    }

    testConnection()
  }, [])

  return (
    <div>
      <h1>CAPIS-2511</h1>
      <p>Supabase Connection Test</p>
    </div>
  )
}

export default App