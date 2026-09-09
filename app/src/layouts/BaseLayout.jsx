import { useLanguage } from "../context/Language";
import { t } from "../domain/language";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
export default function BaseLayout() {
  useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-body">
        <Navbar onMenu={() => setSidebarOpen(current => !current)} />
        <main className="page-content">
          <Outlet />
        </main>
        <Footer />
      </div>
      {sidebarOpen && <button className="sidebar-backdrop" aria-label={t("Close navigation")} onClick={() => setSidebarOpen(false)} />}
    </div>;
}
