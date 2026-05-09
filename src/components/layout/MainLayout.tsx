import type { ReactNode } from "react";

import Navbar from "./Navbar";
import Footer from "./Footer";

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grain-overlay" />

      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(244,176,0,0.12),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(127,29,29,0.12),transparent_32%),linear-gradient(180deg,#070604_0%,#0d0a07_48%,#070604_100%)]" />

      <Navbar />

      <main className="pt-24">{children}</main>

      <Footer />
    </div>
  );
};

export default MainLayout;