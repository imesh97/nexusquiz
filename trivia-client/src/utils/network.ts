const NODE_PORTS = [8000, 8001, 8002];

let cachedLeader: string | null = null;

export async function getLeaderUrl(forceRefresh = false): Promise<string> {
    if (!forceRefresh && cachedLeader !== null) {
      return cachedLeader;
    }
  
    for (const port of NODE_PORTS) {
      try {
        const res = await fetch(`http://localhost:${port}/raft/leader`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.leader_url && typeof data.leader_url === "string") {
            cachedLeader = data.leader_url;
            return data.leader_url;
          }
        }
      } catch (err) {
        console.warn(`[WARN] Node ${port} unreachable or not leader.`);
      }
    }
  
    throw new Error("❌ No leader node could be reached.");
  }
  