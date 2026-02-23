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

  // Handle 204 No Content
  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}
