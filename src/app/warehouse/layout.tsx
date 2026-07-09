// src/app/warehouse/layout.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/nav/Sidebar';
import type { Role } from '@/types/database';

export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (!profile || profile.role !== 'warehouse') redirect('/auth/login');
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#E0E0DC', gap: 20, padding: 20 }}>
      <Sidebar role={profile.role as Role} userName={profile.full_name} />
      <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
    </div>
  );
}
