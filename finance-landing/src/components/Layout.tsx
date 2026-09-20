
import { NavLink, Outlet } from 'react-router-dom';
import { TrendingUp, Search, FileText } from 'lucide-react';

export const Layout = () => {
  return (
    <div className="flex-1 flex overflow-hidden relative">
      <div className="hidden md:flex flex-col w-20 flex-shrink-0 border-r border-border bg-card pt-6 items-center gap-8 z-40">
         <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center border border-primary/30 shadow-md">
            <TrendingUp className="text-primary-foreground w-5 h-5" />
         </div>
         <NavLink to="/" className={({ isActive }) => `p-3 rounded-lg transition-colors ${isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <TrendingUp className="w-6 h-6" />
         </NavLink>
         <NavLink to="/screener" className={({ isActive }) => `p-3 rounded-lg transition-colors ${isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <Search className="w-6 h-6" />
         </NavLink>
         <NavLink to="/watchlist" className={({ isActive }) => `p-3 rounded-lg transition-colors ${isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <FileText className="w-6 h-6" />
         </NavLink>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
         <Outlet />
      </div>
    </div>
  );
};
