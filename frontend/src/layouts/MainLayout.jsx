import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface antialiased flex">
      {/* Fixed Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="w-full pt-16 flex-1 bg-surface">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
