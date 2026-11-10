const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:4000/api"
).replace(/\/+$/, "");

const getFallbackMessage = (status) => {
  if (status === 400) return "Please check the information and try again.";
  if (status === 401)
    return "Your session may have expired. Please sign in again.";
  if (status === 403)
    return "You do not have permission to perform this action.";
  if (status === 404) return "The requested information could not be found.";
  if (status === 409)
    return "This action conflicts with the current records. Please refresh and try again.";
  if (status >= 500) return "Something went wrong. Please try again shortly.";
  return "The request could not be completed. Please try again.";
};

const isTechnicalMessage = (message) =>
  /\b(sqlite|sql|database|stack|traceback|typeerror|referenceerror|syntaxerror|econnrefused|enotfound|internal server error|request failed|fetch failed)\b/i.test(
    message,
  );

export async function api(path, options = {}) {
  const token = localStorage.getItem("freshmart_token");
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error(
      "Unable to connect to the shop server. Please check your connection and try again.",
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const serverMessage =
      typeof data.error === "string" ? data.error.trim() : "";
    const message =
      !serverMessage || isTechnicalMessage(serverMessage)
        ? getFallbackMessage(response.status)
        : serverMessage;
    throw new Error(message);
  }

  return data;
}
