import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BellDot,
  Database,
  GitBranch,
  Radio,
  ShieldCheck,
  FileText,
  MessageSquare,
  ClipboardList,
  LogOut,
} from "lucide-react";

interface NavLinkItem {
  to: string;
  label: string;
  badge?: string;
  icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
}

const navItems: NavLinkItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/alerts", label: "Alerts & Leaks", icon: BellDot, badge: "75" },
  { to: "/data", label: "Data Ingestion", icon: Database },
  { to: "/processes", label: "Revenue Processes", icon: GitBranch },
  { to: "/live", label: "Live Monitor", icon: Radio },
  { to: "/recovery", label: "Recovery Center", icon: ShieldCheck },
  { to: "/reports", label: "Board Reports", icon: FileText },
  { to: "/chat", label: "Narrator AI", icon: MessageSquare },
  { to: "/audit", label: "Audit Trail", icon: ClipboardList },
];

/** Desktop Nav Item with glass hover and spring active indicator */
function DesktopNavItem({
  to,
  label,
  badge,
  icon: Icon,
}: NavLinkItem) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <NavLink
      to={to}
      end={to === "/app"}
      className="relative group outline-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={label}
    >
      {({ isActive }) => (
        <div className="relative flex items-center justify-center">
          {/* Active / Hover Background Capsule */}
          {isActive ? (
            <motion.div
              layoutId="sidebar-active-pill"
              className="absolute inset-0 bg-[#0a0a0a] rounded-2xl shadow-[0_4px_16px_rgba(10,10,10,0.22),0_1px_2px_rgba(10,10,10,0.15)]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          ) : (
            <div className="absolute inset-0 rounded-2xl transition-colors duration-150 group-hover:bg-black/[0.05]" />
          )}

          {/* Icon Button */}
          <div
            className={`relative z-10 w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-150 ${
              isActive
                ? "text-white scale-105"
                : "text-[var(--color-muted)] group-hover:text-[var(--color-ink)]"
            }`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />

            {/* Micro Badge Dot if applicable */}
            {badge && !isActive && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[var(--color-accent)] ring-2 ring-white/80" />
            )}
          </div>

          {/* Hover Tooltip (Flyout Card to the Right) */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 z-[300] pointer-events-none"
                initial={{ opacity: 0, x: -8, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -4, scale: 0.95 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center gap-2 bg-[#0c0c0e] text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.28)] border border-white/10 backdrop-blur-md whitespace-nowrap">
                  <span>{label}</span>
                  {badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/15 text-white/90">
                      {badge}
                    </span>
                  )}
                  {/* Subtle triangle point */}
                  <span
                    className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
                    style={{ borderRightColor: "#0c0c0e" }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </NavLink>
  );
}

/** Sign Out button with tooltip */
function SignOutButton() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const handleSignOut = () => {
    // Clear any session state
    sessionStorage.removeItem("rpt_user_name");
    sessionStorage.removeItem("rpt_company");
    sessionStorage.removeItem("rpt_email");
    navigate("/login");
  };

  return (
    <div className="relative flex items-center justify-center">
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap pointer-events-none z-50"
            style={{
              background: "rgba(10,10,10,0.90)",
              color: "#fff",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            Sign Out
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={handleSignOut}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative w-10 h-10 rounded-2xl flex items-center justify-center text-[var(--color-muted)] hover:text-red-600 hover:bg-red-50 transition-all duration-150"
        aria-label="Sign Out"
      >
        <LogOut size={18} strokeWidth={1.7} />
      </button>
    </div>
  );
}

/** Floating Glassmorphic Desktop Sidebar */
export function Sidebar() {
  return (
    <aside
      className="fixed left-4 top-4 bottom-4 z-[100] hidden md:flex flex-col items-center justify-between w-16 py-4 px-2 select-none"
      style={{
        background: "rgba(255, 255, 255, 0.78)",
        backdropFilter: "blur(20px) saturate(190%)",
        WebkitBackdropFilter: "blur(20px) saturate(190%)",
        border: "1px solid rgba(255, 255, 255, 0.85)",
        borderRadius: "28px",
        boxShadow:
          "0 12px 36px -4px rgba(10, 10, 10, 0.08), 0 4px 12px -2px rgba(10, 10, 10, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.95)",
      }}
    >
      {/* Top Section: Brand Logo Image with subtle glow & hover */}
      <div className="flex flex-col items-center gap-3">
        <NavLink
          to="/"
          className="relative group w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.08)] border border-black/[0.06] transition-transform duration-200 hover:scale-105 overflow-hidden p-1"
          aria-label="Revenue Process Twin Home"
        >
          <img
            src="/logo.png"
            alt="Revenue Process Twin"
            className="w-full h-full object-contain"
          />
        </NavLink>
        <div className="w-6 h-[1px] bg-black/[0.06]" />
      </div>

      {/* Center Section: Navigation Icons */}
      <nav className="flex flex-col items-center gap-2.5 my-auto">
        {navItems.map((item) => (
          <DesktopNavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Bottom Section: Sign Out + System Pulse & Health */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-[1px] bg-black/[0.06]" />

        {/* Sign Out Button */}
        <SignOutButton />

        {/* System health pulse */}
        <NavLink
          to="/audit"
          className="group relative w-10 h-10 rounded-2xl flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-black/[0.04] transition-all"
          aria-label="Engine Active"
        >
          <div className="relative">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] block shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="absolute inset-0 rounded-full bg-[#22c55e] animate-ping opacity-60" />
          </div>
        </NavLink>
      </div>
    </aside>
  );
}

/** Mobile Floating Bottom Nav Pill */
export function MobileBottomNav() {
  return (
    <nav
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex md:hidden items-center gap-1.5 px-3 py-2 select-none"
      style={{
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(24px) saturate(200%)",
        WebkitBackdropFilter: "blur(24px) saturate(200%)",
        border: "1px solid rgba(255, 255, 255, 0.85)",
        borderRadius: "999px",
        boxShadow:
          "0 12px 32px rgba(10, 10, 10, 0.16), 0 4px 12px rgba(10, 10, 10, 0.08), inset 0 1px 1px rgba(255, 255, 255, 1)",
      }}
    >
      <NavLink
        to="/"
        className="w-10 h-10 rounded-full bg-white flex items-center justify-center mr-1 shadow-sm border border-black/[0.06] overflow-hidden p-1"
        aria-label="Home"
      >
        <img
          src="/logo.png"
          alt="Revenue Process Twin"
          className="w-full h-full object-contain"
        />
      </NavLink>

      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/app"}
          className={({ isActive }) =>
            `relative w-11 h-11 flex items-center justify-center rounded-full transition-all duration-150 ${
              isActive
                ? "bg-[#0a0a0a] text-white shadow-md scale-105"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`
          }
          aria-label={label}
        >
          {({ isActive }) => <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />}
        </NavLink>
      ))}
    </nav>
  );
}
