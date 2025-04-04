// src/utils/network.ts

const NODE_PORTS = [8000, 8001, 8002]; // Define all known nodes here

let cachedLeader: string | null = null;

export async function getLeaderUrl(): Promise<string> {
  if (cachedLeader) return cachedLeader;

  for (const port of NODE_PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/raft/leader`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.leader_url) {
          cachedLeader = data.leader_url;
          if (cachedLeader !== null) return cachedLeader;
         
        }
      }
    } catch (err) {
      console.warn(`[WARN] Node ${port} unreachable or not leader.`);
    }
  }

  throw new Error("❌ No leader node could be reached.");
}
