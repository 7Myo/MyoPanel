import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  timeout: 30_000
});

export function setAuthToken(token) {
  if (token) api.defaults.headers.common.Authorization = "Bearer " + token;
  else delete api.defaults.headers.common.Authorization;
}

export function formatBytes(value = 0) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Number(value) || 0;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(msOrSeconds = 0, input = "ms") {
  const seconds = input === "seconds" ? Number(msOrSeconds) : Number(msOrSeconds) / 1000;
  if (!seconds) return "0s";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}j ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${Math.floor(seconds)}s`;
}

export async function downloadFromApi(url, filename) {
  const response = await api.get(url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}
