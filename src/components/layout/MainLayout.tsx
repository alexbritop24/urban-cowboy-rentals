import type { ReactNode } from "react";

import Navbar from "./Navbar";
import Footer from "./Footer";

interface MainLayoutProps {
  children: ReactNode;
  showNavbar?: boolean;
  showFooter?: boolean;
}

const MainLayout = ({ children, showNavbar = true, showFooter = true }: MainLayoutProps) => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grain-overlay" />

      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(244,176,0,0.12),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(127,29,29,0.12),transparent_32%),linear-gradient(180deg,#070604_0%,#0d0a07_48%,#070604_100%)]" />

      {showNavbar && (
        <div className="document-no-print">
          <Navbar />
        </div>
      )}

      <main className={showNavbar ? "pt-24" : undefined}>{children}</main>

      {showFooter && (
        <div className="document-no-print">
          <Footer />
        </div>
      )}
    </div>
  );
};

export default MainLayout;
