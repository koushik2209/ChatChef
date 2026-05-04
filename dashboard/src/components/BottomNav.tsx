import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, ChefHat, CreditCard } from 'lucide-react';

const TABS = [
  { to: '/',        icon: LayoutDashboard, label: 'Home'     },
  { to: '/orders',  icon: ShoppingBag,     label: 'Orders'   },
  { to: '/menu',    icon: UtensilsCrossed, label: 'Menu'     },
  { to: '/cooking', icon: ChefHat,         label: 'Cooking'  },
  { to: '/payments',icon: CreditCard,      label: 'Payments' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#111111] border-t border-[#262626] safe-area-inset-bottom">
      <div className="flex">
        {TABS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#25D366]' : 'text-[#888]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
