'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { DESTINATION_COUNTRIES } from '@/lib/constants'

export default function ProfileSettings() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Account (profiles)
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')

  // Company (customers)
  const [companyName, setCompanyName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [country, setCountry] = useState('')
  const [address, setAddress] = useState('')

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Delivery locations
  const [locations, setLocations] = useState([])
  const [newLocLabel, setNewLocLabel] = useState('')
  const [newLocCountry, setNewLocCountry] = useState('')
  const [newLocAddress, setNewLocAddress] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData)
      setFullName(profileData?.full_name || '')
      setPhoneNumber(profileData?.phone_number || '')

      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('profile_id', user.id)
        .single()

      setCustomer(customerData)
      setCompanyName(customerData?.company_name || '')
      setContactPerson(customerData?.contact_person || '')
      setCompanyEmail(customerData?.email || '')
      setCompanyPhone(customerData?.phone || '')
      setCountry(customerData?.country || '')
      setAddress(customerData?.address || '')

      if (customerData) {
        const { data: locationsData } = await supabase
          .from('customer_locations')
          .select('*')
          .eq('customer_id', customerData.id)
          .order('created_at', { ascending: true })
        setLocations(locationsData || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const notify = (msg) => {
    setError('')
    setMessage(msg)
  }

  const notifyError = (msg) => {
    setMessage('')
    setError(msg)
  }

  const saveAccount = async () => {
    if (!fullName.trim()) { notifyError('Full name is required.'); return }
    setSaving('account')
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone_number: phoneNumber.trim() || null })
      .eq('id', profile.id)

    if (updateError) notifyError('Error: ' + updateError.message)
    else notify('Account details saved.')
    setSaving('')
  }

  const saveCompany = async () => {
    if (!companyName.trim()) { notifyError('Company name is required.'); return }
    setSaving('company')
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        company_name: companyName.trim(),
        contact_person: contactPerson.trim() || null,
        email: companyEmail.trim() || null,
        phone: companyPhone.trim() || null,
        country: country.trim() || null,
        address: address.trim() || null,
      })
      .eq('id', customer.id)

    if (updateError) notifyError('Error: ' + updateError.message)
    else notify('Company profile saved.')
    setSaving('')
  }

  const changePassword = async () => {
    if (newPassword.length < 6) { notifyError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { notifyError('Passwords do not match.'); return }
    setSaving('password')
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    if (updateError) notifyError('Error: ' + updateError.message)
    else {
      notify('Password updated.')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSaving('')
  }

  const reloadLocations = async () => {
    const { data } = await supabase
      .from('customer_locations')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: true })
    setLocations(data || [])
  }

  const addLocation = async () => {
    if (!newLocLabel.trim() || !newLocCountry) {
      notifyError('Location name and country are required.')
      return
    }
    setSaving('location')
    const { error: insertError } = await supabase
      .from('customer_locations')
      .insert({
        customer_id: customer.id,
        label: newLocLabel.trim(),
        country: newLocCountry,
        address: newLocAddress.trim() || null,
        is_default: locations.length === 0,
      })

    if (insertError) notifyError('Error: ' + insertError.message)
    else {
      notify('Delivery location added.')
      setNewLocLabel('')
      setNewLocCountry('')
      setNewLocAddress('')
      await reloadLocations()
    }
    setSaving('')
  }

  const removeLocation = async (id) => {
    setSaving('location')
    const { error: deleteError } = await supabase
      .from('customer_locations')
      .delete()
      .eq('id', id)

    if (deleteError) {
      notifyError(
        deleteError.message.includes('violates foreign key')
          ? 'This location is used by an existing order and cannot be removed.'
          : 'Error: ' + deleteError.message
      )
    } else {
      notify('Delivery location removed.')
      await reloadLocations()
    }
    setSaving('')
  }

  const setDefaultLocation = async (id) => {
    setSaving('location')
    await supabase.from('customer_locations').update({ is_default: false }).eq('customer_id', customer.id)
    const { error: updateError } = await supabase
      .from('customer_locations')
      .update({ is_default: true })
      .eq('id', id)

    if (updateError) notifyError('Error: ' + updateError.message)
    else {
      notify('Default delivery location updated.')
      await reloadLocations()
    }
    setSaving('')
  }

  const inputClass = 'w-full border border-gray-300 rounded px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-400'
  const labelClass = 'block text-xs font-semibold text-gray-500 uppercase mb-1'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* Sidebar */}
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col p-4 fixed h-full">
        <div className="flex items-center gap-2 mb-8">
          <Image src="/dmc-logo.png" alt="DMC" width={36} height={36} />
          <span className="font-semibold text-sm">DMC Export</span>
        </div>
        <p className="text-xs text-gray-400 uppercase mb-2">My Account</p>
        <nav className="flex flex-col gap-1">
          {[
            { label: 'Dashboard', path: '/customer/dashboard' },
            { label: 'My Orders', path: '/customer/orders' },
            { label: 'Product Catalog', path: '/customer/catalog' },
            { label: 'Request Quotation', path: '/customer/quotation/new' },
            { label: 'Documents', path: '/customer/documents' },
            { label: 'Profile & Settings', path: '/customer/profile' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.path)}
              className={`text-left text-sm px-3 py-2 rounded ${item.label === 'Profile & Settings' ? 'font-semibold text-black bg-gray-50' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              • {item.label}
            </button>
          ))}
        </nav>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          className="mt-auto text-left text-sm px-3 py-2 rounded text-gray-600 hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>

      {/* Main Content */}
      <div className="ml-56 flex-1 p-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Profile & settings</h1>
          <p className="text-sm text-gray-500">Manage your company details, account information, and password.</p>
        </div>

        {/* Feedback banners */}
        {message && (
          <div className="bg-white border border-gray-200 rounded p-3 mb-6 text-sm">✓ {message}</div>
        )}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-6">{error}</div>
        )}

        <div className="max-w-2xl space-y-6">

          {/* Company profile */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Company profile</h2>
            <p className="text-xs text-gray-400 mb-4">These details appear on your quotations and export documents.</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Company Name</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contact Person</label>
                <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Company Email</label>
                <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Company Phone</label>
                <input type="text" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Address</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
              </div>
            </div>
            <button
              onClick={saveCompany}
              disabled={saving === 'company' || !customer}
              className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {saving === 'company' ? 'Saving...' : 'Save company profile'}
            </button>
          </div>

          {/* Delivery locations */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Delivery locations</h2>
            <p className="text-xs text-gray-400 mb-4">Your warehouses or facilities. Quotation requests ship to one of these locations.</p>

            {locations.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">No delivery locations yet. Add your first one below — it will be used as the destination on quotation requests.</p>
            ) : (
              <div className="divide-y divide-gray-100 mb-4">
                {locations.map((loc) => (
                  <div key={loc.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {loc.label}
                        {loc.is_default && (
                          <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-black text-white">Default</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{loc.country}{loc.address ? ` · ${loc.address}` : ''}</p>
                    </div>
                    {!loc.is_default && (
                      <button
                        onClick={() => setDefaultLocation(loc.id)}
                        disabled={saving === 'location'}
                        className="text-xs border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => removeLocation(loc.id)}
                      disabled={saving === 'location'}
                      className="text-red-400 hover:text-red-600 text-xs disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4 border-t border-gray-100 pt-4">
              <div>
                <label className={labelClass}>Location Name</label>
                <input
                  type="text"
                  placeholder="e.g. Main warehouse — Kowloon"
                  value={newLocLabel}
                  onChange={(e) => setNewLocLabel(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <select
                  value={newLocCountry}
                  onChange={(e) => setNewLocCountry(e.target.value)}
                  className={`${inputClass} bg-white`}
                >
                  <option value="">Select country...</option>
                  {DESTINATION_COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Address (Optional)</label>
                <input
                  type="text"
                  placeholder="Street, district, city..."
                  value={newLocAddress}
                  onChange={(e) => setNewLocAddress(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              onClick={addLocation}
              disabled={saving === 'location' || !customer}
              className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {saving === 'location' ? 'Saving...' : '+ Add delivery location'}
            </button>
          </div>

          {/* Account details */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Account details</h2>
            <p className="text-xs text-gray-400 mb-4">Your personal login account.</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Login Email</label>
                <input type="email" value={profile?.email || ''} disabled className={`${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed`} />
                <p className="text-xs text-gray-400 mt-1">Contact DMC to change your login email.</p>
              </div>
            </div>
            <button
              onClick={saveAccount}
              disabled={saving === 'account'}
              className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {saving === 'account' ? 'Saving...' : 'Save account details'}
            </button>
          </div>

          {/* Change password */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Change password</h2>
            <p className="text-xs text-gray-400 mb-4">Use at least 6 characters.</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
              </div>
            </div>
            <button
              onClick={changePassword}
              disabled={saving === 'password' || !newPassword}
              className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {saving === 'password' ? 'Updating...' : 'Update password'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
