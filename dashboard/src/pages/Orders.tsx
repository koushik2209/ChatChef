import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, RefreshCw } from 'lucide-react';
import { fetchOrders, updateOrderStatus } from '../api/orders';
import type { Order, OrderStatus } from '../types';
import Layout from '../components/Layout';
import { OrderStatusBadge, PaymentBadge } from '../components/StatusBadge';
import Spinner from '../components/Spinner';

const FILTERS: { label: string; value: string }[] = [
  { label: 'All',        value: ''           },
  { label: 'New',        value: 'NEW'        },
  { label: 'Confirmed',  value: 'CONFIRMED'  },
  { label: 'Preparing',  value: 'PREPARING'  },
  { label: 'Done',       value: 'DONE'       },
  { label: 'Cancelled',  value: 'CANCELLED'  },
];

const NEXT_STATUS: Partial<Record<OrderStatus, { label: string; status: OrderStatus; color: string }[]>> = {
  NEW:       [{ label: 'Confirm',       status: 'CONFIRMED', color: '#f59e0b' }, { label: 'Cancel', status: 'CANCELLED', color: '#ef4444' }],
  CONFIRMED: [{ label: 'Start Cooking', status: 'PREPARING', color: '#f97316' }, { label: 'Cancel', status: 'CANCELLED', color: '#ef4444' }],
  PREPARING: [{ label: 'Mark Done',     status: 'DONE',      color: '#25D366' }],
};

function fmt(n: string | number) {
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function OrderCard({ order }: { order: Order }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (status: OrderStatus) => updateOrderStatus(order.id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });

  const actions = NEXT_STATUS[order.status] ?? [];
  const customerName = order.customer.name ?? order.customer.whatsapp_number;
  const time = new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-[#111111] border border-[#262626] rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center shrink-0">
            <User size={14} color="#888" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{customerName}</p>
            <p className="text-xs text-[#888]">{order.customer.whatsapp_number} · {time}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <OrderStatusBadge status={order.status} />
          <PaymentBadge status={order.payment_status} />
        </div>
      </div>

      {/* Items */}
      <div className="border-t border-[#1f1f1f] pt-3 space-y-1">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-[#ccc]">{item.name} × {item.quantity}</span>
            <span className="text-white font-medium">{fmt(item.price * item.quantity)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-[#1f1f1f]">
          <span className="text-white">Total</span>
          <span className="text-[#25D366]">{fmt(order.total)}</span>
        </div>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex gap-2 pt-1">
          {actions.map(({ label, status, color }) => (
            <button
              key={status}
              onClick={() => mutation.mutate(status)}
              disabled={mutation.isPending}
              className="flex-1 rounded-xl py-2 text-xs font-semibold transition-colors disabled:opacity-50"
              style={{ background: color + '22', color, border: `1px solid ${color}44` }}
            >
              {mutation.isPending ? '...' : label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const [filter, setFilter] = useState('');
  const qc = useQueryClient();

  const { data: orders = [], isLoading, isFetching } = useQuery({
    queryKey: ['orders', filter],
    queryFn: () => fetchOrders(filter || undefined),
    refetchInterval: 30_000,
  });

  return (
    <Layout
      title="Orders"
      action={
        <button onClick={() => qc.invalidateQueries({ queryKey: ['orders'] })} className="text-[#888] hover:text-white p-1">
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
        </button>
      }
    >
      {/* Filter tabs */}
      <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto no-scrollbar">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              filter === value
                ? 'bg-[#25D366] border-[#25D366] text-white'
                : 'border-[#333] text-[#888] bg-transparent hover:border-[#555]'
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
            <p className="text-4xl mb-3">🍽️</p>
            <p className="text-sm">No orders yet</p>
          </div>
        ) : (
          orders.map(o => <OrderCard key={o.id} order={o} />)
        )}
      </div>
    </Layout>
  );
}
