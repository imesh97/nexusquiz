// src/utils/network.ts

const NODE_PORTS = [8000, 8001, 8002]; // Define all known nodes here

export async function getLeaderUrl(): Promise<string> {
  for (const port of NODE_PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/raft/leader`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.leader_url) {
          return data.leader_url;
        }
      }
    } catch (err) {
      console.warn(`[WARN] Node ${port} unreachable or not leader.`);
    }
  }

  console.error("❌ No leader found. Falling back to http://localhost:8000");
  return "http://localhost:8000"; // fallback (can still fail if all nodes are dead)
}
