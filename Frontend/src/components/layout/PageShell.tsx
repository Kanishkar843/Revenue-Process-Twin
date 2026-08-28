import { Sidebar, MobileBottomNav } from "./Sidebar";
import { Topbar } from "./Topbar";

interface Props {
  title: string;
  children: React.ReactNode;
}

/**
 * PageShell — unified workspace shell
 * Desktop: floating glass rail on left (w-16 + 16px margin = 80px),
 *          main content has generous spacing and subtle ambient glow.
 * Mobile: bottom floating nav pill.
 */
export function PageShell({ title, children }: Props) {
  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#f8f9fb]">
      {/* Subtle ambient lighting mesh in the background for depth */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] h-[550px] w-[550px] rounded-full bg-gradient-to-br from-[#6d5bd0]/[0.045] to-[#5c7cfa]/[0.03] blur-3xl" />
        <div className="absolute -bottom-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-[#6d5bd0]/[0.03] to-[#4dab89]/[0.025] blur-3xl" />
      </div>

      {/* Floating Glass Sidebar (Desktop) */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="relative z-10 flex flex-1 flex-col min-w-0 h-screen overflow-hidden md:pl-[88px]">
        {/* Sleek Glass Topbar */}
        <Topbar title={title} />

        {/* Scrollable Page Body */}
        <main
          className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6 pb-28 md:pb-8"
          data-lenis-prevent
        >
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Floating Bottom Nav (Mobile) */}
      <MobileBottomNav />
    </div>
  );
}
