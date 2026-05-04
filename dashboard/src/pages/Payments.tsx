import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPayments, markPaid } from '../api/payments';
import type { Order, PaymentStatus } from '../types';
import Layout from '../components/Layout';
import { OrderStatusBadge } from '../components/StatusBadge';
import Spinner from '../components/Spinner';

function fmt(n: string | number) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function PaymentCard({ order }: { order: Order }) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => markPaid(order.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });

  const name = order.customer.name ?? order.customer.whatsapp_number;
  const time = new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="bg-[#111111] border border-[#262626] rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{name}</p>
          <p className="text-xs text-[#888]">{itemCount} item{itemCount > 1 ? 's' : ''} · {time}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <OrderStatusBadge status={order.status} />
          <span className="text-sm font-bold text-white">{fmt(order.total)}</span>
        </div>
      </div>

      {order.payment_status === 'PENDING' && (
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] font-semibold rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {mutation.isPending ? <Spinner size={14} /> : '✓'}
          Mark as Paid
        </button>
      )}
    </div>
  );
}

const TABS: { label: string; value: PaymentStatus | 'ALL' }[] = [
  { label: 'All',     value: 'ALL'     },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Paid',    value: 'PAID'    },
];

export default function Payments() {
  const [tab, setTab] = useState<PaymentStatus | 'ALL'>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['payments', tab],
    queryFn: () => fetchPayments(tab === 'ALL' ? undefined : tab),
    refetchInterval: 30_000,
  });

  const orders = data?.orders ?? [];
  const summary = data?.summary;

  return (
    <Layout title="Payments">
      {/* Summary strip */}
      {summary && (
        <div className="flex gap-px bg-[#262626] mx-4 mt-4 rounded-2xl overflow-hidden">
          <div className="flex-1 bg-[#052e16] p-3 text-center">
            <p className="text-xs text-[#86efac]/70 font-medium">Collected</p>
            <p className="text-lg font-bold text-[#86efac]">{fmt(summary.paid_total)}</p>
            <p className="text-xs text-[#86efac]/50">{summary.paid_count} orders</p>
          </div>
          <div className="flex-1 bg-[#451a03] p-3 text-center">
            <p className="text-xs text-[#fcd34d]/70 font-medium">Pending</p>
            <p className="text-lg font-bold text-[#fcd34d]">{fmt(summary.pending_total)}</p>
            <p className="text-xs text-[#fcd34d]/50">{summary.pending_count} orders</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        {TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              tab === value
                ? 'bg-[#25D366] border-[#25D366] text-white'
                : 'border-[#333] text-[#888] bg-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 py-2 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={32} /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-[#555]">
            <p className="text-4xl mb-3">💳</p>
            <p className="text-sm">No payments today</p>
          </div>
        ) : (
          orders.map(o => <PaymentCard key={o.id} order={o} />)
        )}
      </div>
    </Layout>
  );
}
