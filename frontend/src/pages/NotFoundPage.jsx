import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-container-high text-primary flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[36px]">error_outline</span>
      </div>
      <h1 className="font-display-lg text-display-lg text-on-surface mb-2">
        404
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-4 py-2.5 rounded-lg font-label-md text-label-md shadow-sm transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}

export default NotFoundPage;
