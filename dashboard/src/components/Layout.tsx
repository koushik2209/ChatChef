import { type ReactNode } from 'react';
import BottomNav from './BottomNav';

interface Props {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export default function Layout({ title, action, children }: Props) {
  return (
    <div className="min-h-dvh flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#262626] px-4 h-14 flex items-center justify-between shrink-0">
        <h1 className="text-base font-semibold text-white">{title}</h1>
        {action && <div>{action}</div>}
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
