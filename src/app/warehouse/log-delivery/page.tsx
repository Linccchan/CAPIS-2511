// src/app/warehouse/log-delivery/page.tsx
// Redirects to dashboard — log-delivery requires a PO ID
import { redirect } from 'next/navigation';
export default function LogDeliveryIndex() { redirect('/warehouse/dashboard'); }
