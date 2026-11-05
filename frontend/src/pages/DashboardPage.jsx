import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getDocuments, createDocument, deleteDocument } from "../api/document.js";
import useAuth from "../hooks/useAuth.js";
import DocumentCard from "../components/document/DocumentCard.jsx";
import TrashView from "../components/document/TrashView.jsx";

function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?._id;

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'grid'

  // Starred documents persisted in localStorage
  const [starredIds, setStarredIds] = useState(() => {
    try {
      const saved = localStorage.getItem("syncspace_starred_docs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleStar = (id) => {
    setStarredIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      try {
        localStorage.setItem("syncspace_starred_docs", JSON.stringify(next));
      } catch { }
      return next;
    });
  };

  const searchParams = new URLSearchParams(location.search);
  const currentFilter = searchParams.get("filter") || "all";

  const fetchDocs = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getDocuments();
      setDocuments(response.documents || []);
    } catch (err) {
      setError(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleCreateDocument = async (title = "Untitled Document") => {
    if (creating) return;
    setCreating(true);
    setError("");

    try {
      const response = await createDocument(title);
      if (response?.document?._id) {
        navigate(`/document/${response.document._id}`);
      }
    } catch (err) {
      setError(err.message || "Failed to create document");
    } finally {
      setCreating(false);
    }
  };

  const handleMoveToTrash = async (doc) => {
    const confirmed = window.confirm(
      `Move "${doc.title || "Untitled Document"}" to Trash? It will be retained for 30 days.`
    );
    if (!confirmed) return;

    try {
      await deleteDocument(doc._id);
      fetchDocs();
    } catch (err) {
      alert(err.message || "Failed to move document to trash");
    }
  };

  const filteredDocuments = useMemo(() => {
    let list = documents.filter((doc) => {
      const isOwner =
        (doc.owner?._id || doc.owner)?.toString() === userId?.toString();

      // Tab filter
      if (currentFilter === "owned" && !isOwner) return false;
      if (currentFilter === "shared" && isOwner) return false;
      if (currentFilter === "starred" && !starredIds.includes(doc._id)) return false;
      if (currentFilter === "trash") return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = doc.title?.toLowerCase().includes(query);
        const ownerMatch = (doc.owner?.name || "").toLowerCase().includes(query);
        if (!titleMatch && !ownerMatch) return false;
      }

      return true;
    });

    if (currentFilter === "recent") {
      // Sort by updatedAt descending and show top 10
      list = [...list]
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .slice(0, 10);
    }

    return list;
  }, [documents, currentFilter, searchQuery, userId, starredIds]);

  const stats = useMemo(() => {
    const total = documents.length;
    const owned = documents.filter(
      (d) => (d.owner?._id || d.owner)?.toString() === userId?.toString()
    ).length;
    const shared = total - owned;
    return { total, owned, shared };
  }, [documents, userId]);

  return (
    <div className="w-full px-4 sm:px-space-xl py-space-lg flex flex-col gap-space-lg max-w-[1240px] mx-auto animate-in fade-in duration-200">
      {/* Workspace Greeting & Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pt-space-xs">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-space-xs text-on-surface-variant flex-wrap">
            <span className="font-code-sm text-code-sm uppercase tracking-wider text-outline">
              SyncSpace • Real-Time Engine
            </span>
            <span className="text-outline text-xs">/</span>
            <span className="font-label-sm text-label-sm text-tertiary font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Socket.IO Cluster Online
            </span>
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">
            Good day, {user?.name?.split(" ")[0] || "Collaborator"}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Here is your collaborative workspace with live CRDT consensus.
          </p>
        </div>

        {/* Dashboard Actions: New Document */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleCreateDocument("Untitled Document")}
            disabled={creating}
            className="group flex items-center gap-space-sm bg-primary hover:bg-primary-container text-on-primary px-space-md py-2.5 rounded-xl shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px] transition-transform group-hover:rotate-90">
              add
            </span>
            <span className="font-label-md text-label-md font-medium tracking-tight">
              {creating ? "Creating…" : "New Document"}
            </span>
          </button>
        </div>
      </div>

      {/* Velocity Stats (3 Balanced Columns - Yjs Engine card removed) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        <div className="p-space-md rounded-xl bg-surface-container-low shadow-xs flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider truncate">
              Total Docs
            </span>
            <span className="font-headline-md text-headline-md text-on-surface mt-0.5">
              {stats.total}
            </span>
            <span className="font-body-sm text-body-sm text-tertiary flex items-center gap-1 mt-0.5 truncate">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              Active stream
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">description</span>
          </div>
        </div>

        <div className="p-space-md rounded-xl bg-surface-container-low shadow-xs flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider truncate">
              Owned By You
            </span>
            <span className="font-headline-md text-headline-md text-on-surface mt-0.5">
              {stats.owned}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 truncate">
              Personal drafts
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-tertiary flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>
        </div>

        <div className="p-space-md rounded-xl bg-surface-container-low shadow-xs flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider truncate">
              Shared Docs
            </span>
            <span className="font-headline-md text-headline-md text-on-surface mt-0.5">
              {stats.shared}
            </span>
            <span className="font-body-sm text-body-sm text-secondary mt-0.5 truncate">
              Collaborations
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">group</span>
          </div>
        </div>
      </div>

      {/* Main Panel with Always-Visible Tabs and Content */}
      <div className="flex flex-col gap-space-md bg-surface-container-lowest rounded-xl shadow-xs border border-[#E8E8E5] overflow-hidden p-space-lg">
        {/* Toolbar & Filter Controls (Always visible so users can switch tabs easily) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-sm border-b border-[#E8E8E5]/60">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-surface-container rounded-lg self-start overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all cursor-pointer whitespace-nowrap ${currentFilter === "all"
                ? "text-on-surface bg-surface-container-lowest shadow-xs font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              All Documents
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard?filter=recent")}
              className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${currentFilter === "recent"
                ? "text-on-surface bg-surface-container-lowest shadow-xs font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              Recent
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard?filter=owned")}
              className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all cursor-pointer whitespace-nowrap ${currentFilter === "owned"
                ? "text-on-surface bg-surface-container-lowest shadow-xs font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              Owned by Me
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard?filter=shared")}
              className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all cursor-pointer whitespace-nowrap ${currentFilter === "shared"
                ? "text-on-surface bg-surface-container-lowest shadow-xs font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              Shared with Me
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard?filter=starred")}
              className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${currentFilter === "starred"
                ? "text-on-surface bg-surface-container-lowest shadow-xs font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              <span className="material-symbols-outlined text-[14px]">star</span>
              Starred
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard?filter=trash")}
              className={`px-3 py-1.5 rounded-md font-label-md text-label-md transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${currentFilter === "trash"
                ? "text-on-surface bg-surface-container-lowest shadow-xs font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
              Trash
            </button>
          </div>

          {/* Search Bar and View Switchers (Visible when not in trash) */}
          {currentFilter !== "trash" && (
            <div className="flex items-center gap-space-sm flex-1 lg:max-w-md justify-end">
              <div className="relative w-full max-w-sm">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  search
                </span>
                <input
                  id="dashboard-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents or members..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest border border-transparent focus:border-[#E8E8E5] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                  </button>
                )}
              </div>

              {/* View switcher */}
              <div className="flex items-center bg-surface-container rounded-lg p-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-1 rounded transition-colors ${viewMode === "list"
                    ? "bg-surface-container-lowest text-on-surface shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  title="List View"
                >
                  <span className="material-symbols-outlined text-[18px]">view_list</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1 rounded transition-colors ${viewMode === "grid"
                    ? "bg-surface-container-lowest text-on-surface shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  title="Grid View"
                >
                  <span className="material-symbols-outlined text-[18px]">grid_view</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content Section: Trash View OR Document List/Grid */}
        {currentFilter === "trash" ? (
          <TrashView
            onDocumentRestored={fetchDocs}
            onBack={() => navigate("/dashboard")}
          />
        ) : (
          <>
            {/* Recent notice banner */}
            {currentFilter === "recent" && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container/60 border border-[#E8E8E5] text-on-surface-variant text-xs sm:text-sm font-medium">
                <span className="material-symbols-outlined text-[18px] text-primary">schedule</span>
                <span>Shows only top 10 recent documents</span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="p-4 rounded-xl bg-error-container text-on-error-container text-body-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">error</span>
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchDocs}
                  className="font-label-md text-label-md underline hover:opacity-80 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading Skeleton */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Synchronizing workspace documents…
                </p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              /* Empty State */
              <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-outline mb-3">
                  <span className="material-symbols-outlined text-[32px]">folder_open</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-1">
                  {searchQuery ? "No matching documents" : "No documents yet"}
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm mb-5">
                  {searchQuery
                    ? `No documents found matching "${searchQuery}". Try a different search term or clear the filter.`
                    : "Create your first collaborative document and invite your team to edit in real time."}
                </p>
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded-lg text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
                  >
                    Clear Search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCreateDocument("Untitled Document")}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md text-label-md transition-colors shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span>Create Document</span>
                  </button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              /* Grid View with responsive columns and clean spacing */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {filteredDocuments.map((doc) => (
                  <DocumentCard
                    key={doc._id}
                    document={doc}
                    userId={userId}
                    viewMode="grid"
                    onOpen={(id) => navigate(`/document/${id}`)}
                    isStarred={starredIds.includes(doc._id)}
                    onToggleStar={toggleStar}
                    onDelete={handleMoveToTrash}
                  />
                ))}
              </div>
            ) : (
              /* List View (Table) */
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/60 text-outline uppercase font-code-sm text-code-sm">
                      <th className="py-2.5 px-space-md rounded-l-lg font-medium tracking-wider w-[36%]">
                        Document Name
                      </th>
                      <th className="py-2.5 px-space-md font-medium tracking-wider w-[16%]">
                        Owner
                      </th>
                      <th className="py-2.5 px-space-md font-medium tracking-wider w-[16%]">
                        Last Modified
                      </th>
                      <th className="py-2.5 px-space-md font-medium tracking-wider w-[18%]">
                        Collaborators
                      </th>
                      <th className="py-2.5 px-space-md font-medium tracking-wider w-[10%]">
                        Access
                      </th>
                      <th className="py-2.5 px-space-md rounded-r-lg text-right font-medium tracking-wider w-[4%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-0">
                    {filteredDocuments.map((doc) => (
                      <DocumentCard
                        key={doc._id}
                        document={doc}
                        userId={userId}
                        viewMode="list"
                        onOpen={(id) => navigate(`/document/${id}`)}
                        isStarred={starredIds.includes(doc._id)}
                        onToggleStar={toggleStar}
                        onDelete={handleMoveToTrash}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
