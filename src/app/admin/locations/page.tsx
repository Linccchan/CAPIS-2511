'use client';
// S18 — Manage Locations  (src/app/admin/locations/page.tsx)
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LocationsPage() {
  const supabase = createClient();
  const [locations, setLocations] = useState<any[]>([]);
  const [zone, setZone] = useState('A');
  const [rack, setRack] = useState('');
  const [slot, setSlot] = useState('');
  const [description, setDescription] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('warehouse_locations')
      .select('*, inventory_batches(quantity_available)')
      .order('location_code');
    setLocations(data ?? []);
  }
  useEffect(() => { load(); }, []);

  const codePreview = zone && rack && slot
    ? `${zone.toUpperCase()}-${rack.padStart(2, '0')}-${slot.padStart(2, '0')}`
    : '—';

  function isOccupied(loc: any) {
    const batches = loc.inventory_batches as any[];
    return (batches?.reduce((s: number, b: any) => s + b.quantity_available, 0) ?? 0) > 0;
  }

  async function handleAdd() {
    if (!zone || !rack || !slot) return;
    setSaving(true);
    await supabase.from('warehouse_locations').insert({
      location_code: codePreview,
      description: description || null,
      is_active: true,
    });
    setRack(''); setSlot(''); setDescription('');
    setSaving(false);
    load();
  }

  async function toggleActive(id: string, currentActive: boolean, occupied: boolean) {
    if (occupied && currentActive) { alert('Cannot deactivate an occupied location.'); return; }
    await supabase.from('warehouse_locations').update({ is_active: !currentActive }).eq('id', id);
    load();
  }

  const zones = [...new Set(locations.map(l => l.location_code.split('-')[0] ?? ''))].sort();
  const filtered = filterZone ? locations.filter(l => l.location_code.startsWith(filterZone + '-')) : locations;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Manage warehouse locations</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          Seed and maintain the rack layout. Stock can only be assigned to locations defined here.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Locations table */}
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', alignSelf: 'center' }}>
              All locations ({locations.length})
            </span>
            <select className="input" style={{ width: 160 }} value={filterZone} onChange={e => setFilterZone(e.target.value)}>
              <option value="">Filter by zone…</option>
              {zones.map(z => <option key={z} value={z}>Zone {z}</option>)}
            </select>
          </div>

          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="table-th">Code</th>
                  <th className="table-th">Zone</th>
                  <th className="table-th">Rack</th>
                  <th className="table-th">Slot</th>
                  <th className="table-th">Occupied</th>
                  <th className="table-th">Active</th>
                  <th className="table-th">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(loc => {
                  const parts = loc.location_code.split('-');
                  const occupied = isOccupied(loc);
                  return (
                    <tr key={loc.id} style={{ opacity: loc.is_active ? 1 : 0.5 }}>
                      <td className="table-td">
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>
                          {loc.location_code}
                        </span>
                      </td>
                      <td className="table-td">{parts[0]}</td>
                      <td className="table-td">{parts[1]}</td>
                      <td className="table-td">{parts[2]}</td>
                      <td className="table-td">
                        {occupied
                          ? <span className="badge badge-dark">Yes</span>
                          : <span className="badge badge-gray">No</span>
                        }
                      </td>
                      <td className="table-td">
                        {loc.is_active
                          ? <span className="badge badge-green">Active</span>
                          : <span className="badge badge-gray">Inactive</span>
                        }
                      </td>
                      <td className="table-td">
                        <button onClick={() => toggleActive(loc.id, loc.is_active, occupied)}
                          className="btn btn-sm btn-ghost" disabled={occupied && loc.is_active}>
                          {loc.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr><td colSpan={7} className="table-td" style={{ textAlign: 'center', padding: 32 }}>No locations yet</td></tr>
                )}
              </tbody>
            </table>
            <p className="info-note" style={{ margin: 12 }}>
              warehouse_locations — is_active toggles availability. Occupied locations cannot be deactivated.
              Occupancy derived from inventory_batches.
            </p>
          </div>
        </div>

        {/* Add location form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>Add location</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label className="section-label">Zone</label>
                <input type="text" className="input" maxLength={2} placeholder="A"
                  value={zone} onChange={e => setZone(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="section-label">Rack</label>
                <input type="number" className="input" min="1" max="99" placeholder="05"
                  value={rack} onChange={e => setRack(e.target.value)} />
              </div>
              <div>
                <label className="section-label">Slot</label>
                <input type="number" className="input" min="1" max="99" placeholder="01"
                  value={slot} onChange={e => setSlot(e.target.value)} />
              </div>
            </div>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Code preview:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{codePreview}</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="section-label">Description (optional)</label>
              <input type="text" className="input" placeholder="e.g. Near loading bay"
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <button onClick={handleAdd} disabled={saving || !zone || !rack || !slot} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? 'Adding…' : 'Add location'}
            </button>
          </div>

          <div className="card card-pad">
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Bulk add range…</div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              To add a full zone, specify the zone letter and how many racks/slots to generate. E.g. Zone C, 5 racks × 4 slots = 20 locations.
            </p>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
              Open bulk generator
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
