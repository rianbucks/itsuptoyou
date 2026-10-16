export function devModeFromUrl() {
  return new URLSearchParams(location.search).get("dev") === "1";
}
