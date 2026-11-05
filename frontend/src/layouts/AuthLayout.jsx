import { Outlet } from "react-router-dom";

function AuthLayout() {
  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md flex flex-col items-center mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary shadow-sm font-semibold text-lg">
            S
          </div>
          <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            SyncSpace
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Your team's ideas, in sync
        </p>
      </div>

      <div className="w-full max-w-md bg-surface-container-lowest border border-[#E8E8E5] rounded-xl shadow-[0_1px_3px_rgba(25,25,24,0.05)] p-8">
        <Outlet />
      </div>

      <div className="mt-8 text-center">
        <p className="font-label-sm text-label-sm text-outline">
          SyncSpace Collaborative Document Editor
        </p>
      </div>
    </div>
  );
}

export default AuthLayout;
