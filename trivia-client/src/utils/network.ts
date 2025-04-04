/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
const NODE_PORTS = [8000, 8001, 8002];
const DEBUG = false;

interface LeaderCache {
  url: string;
  timestamp: number;
  lastSuccessfulPort: number;
}

let cachedLeader: LeaderCache | null = null;
const CACHE_TTL = 3000; // 3 seconds

// Helper for logging
function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log("[NETWORK]", ...args);
  }
}

// Helper to log warnings without red text
function debugWarning(...args: any[]) {
  if (DEBUG) {
    console.warn("[NETWORK]", ...args);
  }
}

// This function tries a specific port
async function tryPort(port: number): Promise<string | null> {
  debugLog(`Trying port ${port}...`);

  try {
    // Use basic fetch with timeout via Promise.race
    const timeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 1500)
    );

    const fetchPromise = fetch(`http://localhost:${port}/raft/leader`, {
      cache: "no-store",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    // Race between fetch and timeout
    const response = (await Promise.race([
      fetchPromise,
      timeoutPromise,
    ])) as Response;

    if (response.ok) {
      const data = await response.json();
      debugLog(`Port ${port} returned:`, data);

      if (data.leader_url && typeof data.leader_url === "string") {
        return data.leader_url;
      }
    }

    return null;
  } catch (err) {
    // Silent failure - don't log errors here
    return null;
  }
}

export async function getLeaderUrl(): Promise<string> {
  const now = Date.now();

  // Check if cache is still valid
  if (cachedLeader && now - cachedLeader.timestamp < CACHE_TTL) {
    debugLog(`Using cached leader: ${cachedLeader.url}`);
    return cachedLeader.url;
  }

  // First try the last successful port if we have one
  if (cachedLeader?.lastSuccessfulPort) {
    const leaderUrl = await tryPort(cachedLeader.lastSuccessfulPort);
    if (leaderUrl) {
      cachedLeader = {
        url: leaderUrl,
        timestamp: now,
        lastSuccessfulPort: cachedLeader.lastSuccessfulPort,
      };
      debugLog(`Got leader from last port: ${leaderUrl}`);
      return leaderUrl;
    }
  }

  // Try all ports in order (simple and predictable)
  for (const port of NODE_PORTS) {
    const leaderUrl = await tryPort(port);
    if (leaderUrl) {
      cachedLeader = {
        url: leaderUrl,
        timestamp: now,
        lastSuccessfulPort: port,
      };
      debugLog(`Got leader from port ${port}: ${leaderUrl}`);
      return leaderUrl;
    }
  }

  // If all ports failed but we have a cached leader, use it
  if (cachedLeader) {
    debugLog(`Using cached leader as fallback: ${cachedLeader.url}`);
    // Reset timestamp to force refresh on next call
    cachedLeader.timestamp = now - CACHE_TTL + 1000;
    return cachedLeader.url;
  }

  // Last resort - just pick the first port and hope for the best
  const defaultPort = NODE_PORTS[0];
  const defaultUrl = `http://localhost:${defaultPort}`;

  cachedLeader = {
    url: defaultUrl,
    timestamp: now,
    lastSuccessfulPort: defaultPort,
  };

  // Only show critical warnings, not errors
  console.warn(`⚠️ No active leader found. Using default: ${defaultUrl}`);
  return defaultUrl;
}

export function clearLeaderCache(): void {
  cachedLeader = null;
  debugLog("Leader cache cleared");
}
