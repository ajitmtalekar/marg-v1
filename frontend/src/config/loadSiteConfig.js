export async function loadSiteConfig() {
  const res = await fetch("/config/site-config.json", {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error("Failed to load site-config.json");
  }

  return res.json();
}
