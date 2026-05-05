import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ShoppingBag, Clock, LogOut, RefreshCw, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchSummary } from '../api/dashboard';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import Spinner from '../components/Spinner';

const WA_NUMBER = import.meta.env.VITE_CHATCHEF_WA_NUMBER ?? '';

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Home() {
  const { seller, logout } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchSummary,
    refetchInterval: 60_000,
  });

  const today = data?.today;
  const link = seller?.slug ? `https://wa.me/${WA_NUMBER}?text=${seller.slug}` : '';

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silent fail
    }
  }

  return (
    <Layout
      title="ChatChef"
      action={
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="text-[#888] hover:text-white transition-colors p-1">
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="text-[#888] hover:text-white transition-colors p-1"
          >
            <LogOut size={16} />
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-6">
        {/* Greeting */}
        <div>
          <p className="text-[#888] text-sm">Good day,</p>
          <h2 className="text-xl font-bold text-white">{seller?.name ?? 'Chef'} 👋</h2>
        </div>

        {/* Shareable link */}
        {link && (
          <div className="bg-[#111111] border border-[#25D366]/30 rounded-2xl p-4">
            <p className="text-xs text-[#25D366] font-medium mb-2">Your customer order link</p>
            <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded-xl px-3 py-2.5">
              <span className="text-sm text-white flex-1 truncate">{link}</span>
              <button onClick={copyLink} aria-label={copied ? 'Copied' : 'Copy link'} className="text-[#888] hover:text-white shrink-0">
                {copied ? <Check size={15} color="#25D366" /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        )}

        {/* Stat cards */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={32} /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Today's Orders"
              value={today?.total_orders ?? 0}
              sub={`${today?.active_orders ?? 0} active`}
              icon={<ShoppingBag size={16} color="#25D366" />}
              accent
            />
            <StatCard
              label="Revenue"
              value={fmt(today?.revenue ?? 0)}
              sub="from paid orders"
              icon={<TrendingUp size={16} color="#25D366" />}
              accent
            />
            <div className="col-span-2">
              <StatCard
                label="Pending Payments"
                value={today?.pending_payments_count ?? 0}
                sub={today?.pending_payments_amount ? `${fmt(today.pending_payments_amount)} outstanding` : 'All clear'}
                icon={<Clock size={16} color={today?.pending_payments_count ? '#f59e0b' : '#25D366'} />}
              />
            </div>
          </div>
        )}

        {/* Order breakdown */}
        {today && (
          <div className="bg-[#111111] border border-[#262626] rounded-2xl p-4">
            <h3 className="text-xs text-[#888] uppercase tracking-wider font-medium mb-3">Order Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(today.orders_by_status)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="text-[#aaa] capitalize">{status.toLowerCase()}</span>
                    <span className="font-semibold text-white">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-[#111111] border border-[#262626] rounded-2xl p-4">
          <h3 className="text-xs text-[#888] uppercase tracking-wider font-medium mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'View Orders',   path: '/orders'   },
              { label: 'Cooking List',  path: '/cooking'  },
              { label: 'Manage Menu',   path: '/menu'     },
              { label: 'Payments',      path: '/payments' },
            ].map(({ label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="bg-[#1a1a1a] hover:bg-[#222] border border-[#333] rounded-xl py-2.5 text-sm text-white transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
