import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { navigationConfig } from '../../config/navigation';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Find matching nav item
  let currentTitle = 'Dashboard';
  for (const group of navigationConfig) {
    const found = group.items.find((item) => item.path === currentPath);
    if (found) {
      currentTitle = found.label;
      break;
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm font-medium">
      {/* Desktop view: DevWeave / Page */}
      <div className="hidden sm:flex items-center gap-2">
        <Link
          to="/dashboard"
          className="text-white/40 transition-colors hover:text-white/80"
        >
          DevWeave
        </Link>
        <ChevronRight className="h-4 w-4 text-white/20" />
        <span className="text-white/90 font-semibold">{currentTitle}</span>
      </div>

      {/* Mobile view: Current page title only */}
      <div className="flex sm:hidden items-center">
        <span className="text-white/90 font-semibold text-base">{currentTitle}</span>
      </div>
    </nav>
  );
};
