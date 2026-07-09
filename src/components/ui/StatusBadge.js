// src/components/ui/StatusBadge.js
const COLORS = {
    draft: 'badge-gray', sent: 'badge-mid', partially_delivered: 'badge-yellow',
    delivered: 'badge-green', cancelled: 'badge-red',
    pending_confirmation: 'badge-yellow', received: 'badge-green',
    with_discrepancy: 'badge-yellow', rejected: 'badge-red',
    pending: 'badge-gray', in_progress: 'badge-blue', completed: 'badge-green',
    photo_sent: 'badge-mid', awaiting_customer: 'badge-yellow',
    design_received: 'badge-blue', printed: 'badge-green',
    good: 'badge-green', damaged: 'badge-red', missing: 'badge-yellow', wrong_item: 'badge-red',
    overdue: 'badge-red',
};
const LABELS = {
    pending_confirmation: 'Pending Confirmation', partially_delivered: 'Partially Delivered',
    with_discrepancy: 'With Discrepancy', in_progress: 'In Progress',
    photo_sent: 'Photo Sent', awaiting_customer: 'Awaiting Customer',
    design_received: 'Design Received', wrong_item: 'Wrong Item',
};
export function StatusBadge({ status }) {
    const cls = COLORS[status] ?? 'badge-gray';
    const label = LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return <span className={`badge ${cls}`}>{label}</span>;
}
