import axios from "axios";

const API_BASE = import.meta.env["VITE_API_URL"] || "/api";

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

/** Build a full API URL (used for non-axios requests like EventSource) */
export function buildApiUrl(endpoint: string): string {
  return `${API_BASE}${endpoint}`;
}

/**
 * Response interceptor: unwrap the `{ success, data, error }` envelope.
 * - On `success: true` → return `response.data.data`
 * - On `success: false` → reject with the server error message
 * - On 401 → redirect to login page
 * - On network / non-2xx errors → reject with a human-readable message
 */
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data;

    // If the server returns our standard envelope
    if (body && typeof body === "object" && "success" in body) {
      if (body.success) {
        // Replace response.data with the unwrapped payload
        response.data = body.data;
        return response;
      }
      // Server returned { success: false, error: "..." }
      return Promise.reject(new ApiError(body.error ?? "An error occurred", response.status));
    }

    return response;
  },
  (error) => {
    if (axios.isAxiosError(error)) {
      // On 401, redirect to login (session expired / unauthorized)
      if (error.response?.status === 401) {
        const currentPath = window.location.pathname;
        if (currentPath !== "/login" && currentPath !== "/register") {
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
        return Promise.reject(new ApiError("Session expired. Please sign in again.", 401));
      }

      // On 429, show a user-friendly rate limit message
      if (error.response?.status === 429) {
        return Promise.reject(
          new ApiError("Too many requests. Please slow down and try again.", 429)
        );
      }

      const message =
        error.response?.data?.error ??
        error.response?.data?.message ??
        error.message ??
        "Network error";
      return Promise.reject(new ApiError(message, error.response?.status));
    }
    return Promise.reject(error);
  }
);

/** Typed API error with status code */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Extract a user-friendly message from any error */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}
