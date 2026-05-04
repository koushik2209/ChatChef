import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ChefHat } from 'lucide-react';
import { fetchCookingSummary } from '../api/orders';
import Layout from '../components/Layout';
import Spinner from '../components/Spinner';

export default function CookingSummary() {
  const qc = useQueryClient();

  const { data: items = [], isLoading, isFetching } = useQuery({
    queryKey: ['cooking-summary'],
    queryFn: fetchCookingSummary,
    refetchInterval: 60_000,
  });

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Layout
      title="Cooking Summary"
      action={
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['cooking-summary'] })}
          className="text-[#888] hover:text-white p-1"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
        </button>
      }
    >
      <div className="p-4 space-y-4">
        {/* Header stat */}
        <div className="bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 flex items-center justify-center">
            <ChefHat size={20} color="#25D366" />
          </div>
          <div>
            <p className="text-xs text-[#25D366]/80 font-medium">Total Items to Cook</p>
            <p className="text-3xl font-bold text-white leading-none">{totalItems}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={32} /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-[#555]">
            <p className="text-5xl mb-3">😴</p>
            <p className="text-sm">Nothing to cook yet today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div
                key={item.menuItemId}
                className="bg-[#111111] border border-[#262626] rounded-2xl px-4 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-white">{item.name}</p>
                  <p className="text-xs text-[#888] mt-0.5">₹{item.unitPrice} each</p>
                </div>
                {/* Big quantity number */}
                <span className="text-5xl font-black text-[#25D366] leading-none tabular-nums">
                  {item.quantity}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-[#555] pb-2">
          Includes NEW, CONFIRMED and PREPARING orders · Auto-refreshes every minute
        </p>
      </div>
    </Layout>
  );
}
