// src/utils/network.ts
const NODE_PORTS = [8000, 8001, 8002];

// Debug mode - set to true to see detailed logs
const DEBUG = true;

interface LeaderCache {
  url: string;
  timestamp: number;
  lastSuccessfulPort: number;
}

let cachedLeader: LeaderCache | null = null;
const CACHE_TTL = 3000; // Shorter cache TTL (3 seconds)

// Helper for logging
function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log("[NETWORK]", ...args);
  }
}

// This function tries a specific port
async function tryPort(port: number): Promise<string | null> {
  debugLog(`Trying to reach leader via port ${port}...`);
  
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
        "Accept": "application/json"
      }
    });
    
    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
    
    if (response.ok) {
      const data = await response.json();
      debugLog(`Port ${port} returned:`, data);
      
      if (data.leader_url && typeof data.leader_url === "string") {
        return data.leader_url;
      }
    }
    
    debugLog(`Port ${port} failed with status:`, response.status);
    return null;
  } catch (err) {
    debugLog(`Port ${port} error:`, err);
    return null;
  }
}

export async function getLeaderUrl(): Promise<string> {
  const now = Date.now();
  debugLog(`Fetching leader URL at ${now}, cached:`, cachedLeader);
  
  // Check if cache is still valid
  if (cachedLeader && now - cachedLeader.timestamp < CACHE_TTL) {
    debugLog(`Using cached leader: ${cachedLeader.url}, age: ${now - cachedLeader.timestamp}ms`);
    return cachedLeader.url;
  }
  
  // First try the last successful port if we have one
  if (cachedLeader?.lastSuccessfulPort) {
    debugLog(`First trying last successful port: ${cachedLeader.lastSuccessfulPort}`);
    const leaderUrl = await tryPort(cachedLeader.lastSuccessfulPort);
    if (leaderUrl) {
      cachedLeader = { 
        url: leaderUrl, 
        timestamp: now,
        lastSuccessfulPort: cachedLeader.lastSuccessfulPort
      };
      debugLog(`Successfully got leader from last port: ${leaderUrl}`);
      return leaderUrl;
    }
  }
  
  // Try ports in a random order to avoid always hitting the same one first
  const shuffledPorts = [...NODE_PORTS].sort(() => Math.random() - 0.5);
  debugLog(`Trying ports in order: ${shuffledPorts.join(", ")}`);
  
  for (const port of shuffledPorts) {
    const leaderUrl = await tryPort(port);
    if (leaderUrl) {
      cachedLeader = { 
        url: leaderUrl, 
        timestamp: now,
        lastSuccessfulPort: port
      };
      debugLog(`Successfully got leader from port ${port}: ${leaderUrl}`);
      return leaderUrl;
    }
  }
  
  // If we've tried all ports and still have a cached leader, use it as fallback
  if (cachedLeader) {
    debugLog(`All ports failed. Falling back to cached leader: ${cachedLeader.url}`);
    // Reset timestamp to force refresh on next call
    cachedLeader.timestamp = now - CACHE_TTL + 1000;
    return cachedLeader.url;
  }
  
  // Last resort - use a hardcoded list and try each one
  debugLog("All connection attempts failed. Trying direct hardcoded URLs.");
  for (const port of NODE_PORTS) {
    const url = `http://localhost:${port}`;
    debugLog(`Trying hardcoded URL: ${url}`);
    
    try {
      // Do a simple ping test
      const response = await fetch(`${url}/raft/heartbeat`, { 
        cache: "no-store",
        mode: "cors",
        signal: AbortSignal.timeout(1000)
      });
      
      if (response.ok) {
        debugLog(`Hardcoded URL ${url} responded successfully`);
        cachedLeader = {
          url,
          timestamp: now,
          lastSuccessfulPort: port
        };
        return url;
      }
    } catch (err) {
      debugLog(`Hardcoded URL ${url} failed:`, err);
    }
  }
  
  // If we reach here, nothing worked - throw a descriptive error
  const error = "❌ No leader node could be reached after trying all options";
  debugLog(error);
  throw new Error(error);
}

export function clearLeaderCache(): void {
  cachedLeader = null;
  debugLog("Leader cache cleared");
}

// Add a function to explicitly test connectivity to all nodes
export async function testConnectivity(): Promise<void> {
  debugLog("Testing connectivity to all nodes...");
  
  for (const port of NODE_PORTS) {
    try {
      const startTime = Date.now();
      const response = await fetch(`http://localhost:${port}/raft/heartbeat`, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(1500)
      });
      
      const elapsed = Date.now() - startTime;
      const status = response.status;
      const text = await response.text();
      
      debugLog(`Port ${port}: Response in ${elapsed}ms, Status=${status}, Response=${text}`);
    } catch (error) {
      debugLog(`Port ${port}: Failed - ${error}`);
    }
  }
  
  debugLog("Connectivity test complete");
}

// Call this function when the application loads
if (typeof window !== 'undefined') {
  // Only run in browser context
  window.addEventListener('load', () => {
    debugLog("Running initial connectivity test...");
    testConnectivity();
  });
}