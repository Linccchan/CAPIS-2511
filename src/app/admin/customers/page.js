'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function CustomersPage() {
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const blankCustomer = {
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    country: '',
    address: '',
  };

  const [form, setForm] = useState(blankCustomer);

  useEffect(() => {
    async function loadCustomers() {
      setLoading(true);

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customers:', error);
      } else {
        setCustomers(data ?? []);
      }

      setLoading(false);
    }

    loadCustomers();
  }, [supabase]);

  const filteredCustomers = customers.filter(customer => {
    const search = filter.toLowerCase();

    return (
      customer.company_name?.toLowerCase().includes(search) ||
      customer.contact_person?.toLowerCase().includes(search) ||
      customer.email?.toLowerCase().includes(search) ||
      customer.country?.toLowerCase().includes(search)
    );
  });


  async function createCustomer(e) {
    e.preventDefault();

    setSaving(true);

    if (editing) {
        const { data, error } = await supabase
        .from('customers')
        .update({
            company_name: form.company_name,
            contact_person: form.contact_person,
            email: form.email,
            phone: form.phone,
            country: form.country,
            address: form.address,
        })
        .eq('id', selectedCustomerId)
        .select()
        .single();

        setSaving(false);

        if (error) {
        alert(error.message);
        return;
        }

        setCustomers(prev =>
        prev.map(customer =>
            customer.id === selectedCustomerId ? data : customer
        )
        );

        alert('Customer updated successfully!');
    } else {
        const response = await fetch('/api/invite-customer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
        });

        const result = await response.json();

        setSaving(false);

        if (!response.ok) {
        alert(result.error);
        return;
        }

        setCustomers(prev => [result, ...prev]);

        alert(
        'Customer created successfully. An invitation email has been sent.'
        );
    }

    setEditing(false);
    setSelectedCustomerId(null);
    setForm(blankCustomer);
    setShowModal(false);
  }

  function editCustomer(customer) {
    setEditing(true);
    setSelectedCustomerId(customer.id);

    setForm({
        company_name: customer.company_name || '',
        contact_person: customer.contact_person || '',
        email: customer.email || '',
        phone: customer.phone || '',
        country: customer.country || '',
        address: customer.address || '',
    });

    setShowModal(true);
  }


  async function deleteCustomer(id) {
    const confirmed = window.confirm(
        'Are you sure you want to delete this customer?'
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

    if (error) {
        alert(error.message);
        return;
    }

    setCustomers(prev =>
        prev.filter(customer => customer.id !== id)
    );

    alert('Customer deleted successfully!');
  }


  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: 'var(--text-primary)',
          }}
        >
          Customer Management
        </div>

        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginTop: 4,
          }}
        >
          View and manage registered customers.
        </div>
      </div>


      <div
        style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        }}
        >
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <input
          className="input"
          type="text"
          placeholder="Search company, contact, email..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 350 }}
        />
      </div>

        <button
            className="btn btn-primary"
            onClick={() => {
                setEditing(false);
                setSelectedCustomerId(null);
                setForm(blankCustomer);
                setShowModal(true);
            }}
        >
            + Add Customer
        </button>
        </div>

      {/* Table */}
      <div className="card">
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr>
              <th className="table-th">Company</th>
              <th className="table-th">Contact Person</th>
              <th className="table-th">Email</th>
              <th className="table-th">Phone</th>
              <th className="table-th">Country</th>
              <th className="table-th">Address</th>
              <th className="table-th">Created</th>
              <th className="table-th">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="table-td"
                  style={{
                    textAlign: 'center',
                    padding: 32,
                  }}
                >
                  Loading customers...
                </td>
              </tr>
            ) : filteredCustomers.length ? (
              filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="table-td">
                    <div
                      className="td-primary"
                      style={{ fontWeight: 600 }}
                    >
                      {customer.company_name}
                    </div>

                    {customer.odoo_customer_id && (
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-tertiary)',
                          fontFamily: 'monospace',
                        }}
                      >
                        Odoo: {customer.odoo_customer_id}
                      </div>
                    )}
                  </td>

                  <td className="table-td">
                    {customer.contact_person || '-'}
                  </td>

                  <td className="table-td">
                    {customer.email || '-'}
                  </td>

                  <td className="table-td">
                    {customer.phone || '-'}
                  </td>

                  <td className="table-td">
                    {customer.country || '-'}
                  </td>

                  <td className="table-td">
                    {customer.address || '-'}
                  </td>

                  <td className="table-td">
                    {customer.created_at
                      ? new Date(customer.created_at).toLocaleDateString()
                      : '-'}
                  </td>

                  <td className="table-td">
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="rounded border border-blue-200 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                            onClick={() => editCustomer(customer)}
                        >
                            Edit
                        </button>

                        <button
                            className="rounded border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                            onClick={() => deleteCustomer(customer.id)}
                        >
                            Delete
                        </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="table-td"
                  style={{
                    textAlign: 'center',
                    padding: 32,
                  }}
                >
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div
      className="bg-white rounded-lg p-6"
      style={{
        width: 550,
      }}
    >
      <h2
        style={{
          fontSize: 22,
          marginBottom: 20,
          fontWeight: 600,
        }}
      >
        {editing ? 'Edit Customer' : 'Add Customer'}
      </h2>

      <form onSubmit={createCustomer}>
        <div
          style={{
            display: 'grid',
            gap: 14,
          }}
        >
          <input
            className="input"
            placeholder="Company Name"
            required
            value={form.company_name}
            onChange={(e) =>
              setForm({
                ...form,
                company_name: e.target.value,
              })
            }
          />

          <input
            className="input"
            placeholder="Contact Person"
            value={form.contact_person}
            onChange={(e) =>
              setForm({
                ...form,
                contact_person: e.target.value,
              })
            }
          />

          <input
            className="input"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
          />

          <input
            className="input"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) =>
              setForm({
                ...form,
                phone: e.target.value,
              })
            }
          />

          <input
            className="input"
            placeholder="Country"
            value={form.country}
            onChange={(e) =>
              setForm({
                ...form,
                country: e.target.value,
              })
            }
          />

          <textarea
            className="input"
            rows={3}
            placeholder="Address"
            value={form.address}
            onChange={(e) =>
              setForm({
                ...form,
                address: e.target.value,
              })
            }
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 24,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
                setShowModal(false);
                setEditing(false);
                setSelectedCustomerId(null);
                setForm(blankCustomer);
            }}
          >
            Cancel
          </button>

          <button
            className="btn btn-primary"
            disabled={saving}
          >
            {saving
                ? editing
                    ? 'Saving...'
                    : 'Creating...'
                : editing
                ? 'Save Changes'
                : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
    </div>
    
  );
}



