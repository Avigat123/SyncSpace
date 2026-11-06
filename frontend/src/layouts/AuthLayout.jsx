import { Outlet } from "react-router-dom";

function AuthLayout() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-x-hidden selection:bg-blue-500 selection:text-white"
      style={{
        background:
          "radial-gradient(circle at 18% 88%, #1668e3 0%, #0c388f 35%, #051d52 65%, #020b22 100%)",
      }}
    >
      <main className="w-full flex items-center justify-center z-10">
        <Outlet />
      </main>
    </div>
  );
}

export default AuthLayout;
