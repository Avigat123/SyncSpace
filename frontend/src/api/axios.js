const BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/**
 * Thin fetch wrapper that always sends credentials (cookies) and
 * attaches the Content-Type header for JSON requests.
 * 
 * Instead of writing this everywhere:
 * fetch("http://localhost:5000/api/documents", {
    method: "GET",
    credentials: "include"
});
 * 
 * You can simply write:
 * request("/documents");
 */
async function request(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
        credentials: "include",          // sends the HTTP-only token cookie
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        ...options,
    });

    let data;
    try {
        data = await response.json();
    } catch {
        data = { message: response.statusText || "Request failed" };
    }

    if (!response.ok) {
        // If an authenticated endpoint returns 401, trigger session invalidation across tabs
        if (
            response.status === 401 &&
            !path.startsWith("/auth/me") &&
            !path.startsWith("/auth/login") &&
            !path.startsWith("/auth/register")
        ) {
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("syncspace:unauthorized"));
            }
        }

        throw new Error(data.message || "Request failed");
    }

    return data;
}

export default request;
