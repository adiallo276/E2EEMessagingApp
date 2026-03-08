export async function api(path: string, options: RequestInit = {}) {
  if (typeof window === "undefined") {
    throw new Error("api() should only be called from the client");
  }

  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

/**
 * Upload a file via multipart/form-data (used for profile picture uploads).
 * Does NOT set Content-Type — the browser sets the correct multipart boundary automatically.
 */
export async function apiUpload(path: string, file: File) {
  if (typeof window === "undefined") {
    throw new Error("apiUpload() should only be called from the client");
  }

  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload error ${res.status}: ${text}`);
  }

  return res.text();
}

/**
 * Returns the absolute URL for a user's profile picture.
 * Use as an <img src> value — the backend serves raw image bytes at this path.
 */
export function profilePictureUrl(username: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}/users/${encodeURIComponent(username)}/profile-picture`;
}
