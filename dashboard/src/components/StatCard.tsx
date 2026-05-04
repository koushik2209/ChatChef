import { type ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  accent?: boolean;
}

export default function StatCard({ label, value, sub, icon, accent }: Props) {
  return (
    <div className="bg-[#111111] border border-[#262626] rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#888] uppercase tracking-wider font-medium">{label}</span>
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: accent ? 'rgba(37,211,102,0.12)' : 'rgba(255,255,255,0.05)' }}
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        {sub && <p className="text-xs text-[#888] mt-1">{sub}</p>}
      </div>
    </div>
  );
}
