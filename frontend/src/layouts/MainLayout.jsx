import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header";

function MainLayout() {
  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface antialiased flex flex-col">
      <Header />
      <main className="w-full pt-16 flex-1 bg-surface">
        <Outlet />
      </main>
    </div>
  );
}

export default MainLayout;
