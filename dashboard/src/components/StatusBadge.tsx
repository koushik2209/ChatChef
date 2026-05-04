import type { OrderStatus, PaymentStatus } from '../types';

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'New',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cls = `badge-${status.toLowerCase()}`;
  return (
    <span className={`${cls} text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const cls = `badge-${status.toLowerCase()}`;
  return (
    <span className={`${cls} text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide`}>
      {status === 'PAID' ? '✓ Paid' : '⏳ Pending'}
    </span>
  );
}
