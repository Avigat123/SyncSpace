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

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

export default request;
