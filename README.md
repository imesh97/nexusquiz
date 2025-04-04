# NexusQuiz - Distributed Trivia Game

NexusQuiz is a real-time multiplayer trivia game built as a distributed system with fault tolerance capabilities. This project demonstrates core distributed systems concepts including leader election, state replication, and fault tolerance.

By: Imesh Nimsitha, Que Hung Dang, Randeep Bhalla, Nathen Fernandes

## Features

- **Real-time Multiplayer**: Join game lobbies and compete with friends
- **Distributed Backend**: Multiple server nodes with automatic failover
- **Fault Tolerance**: Continues to work if servers go offline
- **Leader Election**: Simplified RAFT algorithm for consensus
- **Data Replication**: Game state synchronized across all nodes
- **WebSocket Communication**: Real-time game updates and scoring

## Architecture

### Frontend

- **Next.js**: React framework for the user interface
- **Zustand**: State management for game data
- **Custom WebSocket Hook**: Resilient connections with auto-reconnect
- **Dynamic Leader Discovery**: Smart routing to available servers

### Backend

- **FastAPI**: High-performance Python API framework
- **RAFT Consensus**: Simplified implementation for leader election
- **WebSockets**: Real-time communication with clients
- **Consistent Hashing**: For data placement across nodes

## Getting Started

### Prerequisites

- Node.js 16+ and npm for frontend
- Python 3.9+ for backend
- Multiple terminal windows for running distributed system

### Backend Setup

1. Clone the repository

   ```bash
   git clone https://github.com/alexdng10/CS4459.git
   cd CS4459/trivia-server
   ```

2. Create a virtual environment

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   ```

3. Install dependencies

   ```bash
   pip install -r requirements.txt
   ```

4. Start multiple server nodes

   ```bash
   # Terminal 1 - Leader node (lowest port)
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload

   # Terminal 2 - Follower node
   uvicorn app:app --host 0.0.0.0 --port 8001

   # Terminal 3 - Follower node
   uvicorn app:app --host 0.0.0.0 --port 8002
   ```

### Frontend Setup

1. Navigate to the frontend directory

   ```bash
   cd ../trivia-client
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Start the development server

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Testing

### General Testing

Once the frontend and backend are running together:

1. Access the application at http://localhost:3000
2. Create a new game by entering a nickname and generating a game code
3. Join the game from another browser/incognito window with a different nickname
4. Start the game as the host and verify questions appear properly
5. Answer questions and verify score updates correctly
6. Verify game completion and leaderboard display

### Fault Tolerance Testing

You can simulate node failures to observe the fault tolerance in action:

1. Start all three nodes as described above
2. Start a game with multiple players
3. Kill the leader node (typically port 8000) by pressing Ctrl+C in its terminal
4. Observe how a new leader is elected and clients reconnect
5. The game continues without interruption

## How It Works

### RAFT Leader Election

NexusQuiz implements a simplified version of the RAFT consensus algorithm for leader election:

1. Nodes monitor each other through heartbeat requests
2. The node with the lowest port number becomes the leader
3. If the leader fails, remaining nodes elect a new leader
4. All write operations go through the leader
5. State is replicated to all follower nodes

### Fault Tolerance

The system maintains availability even when nodes fail:

1. If a follower node fails, the system continues to function normally
2. If the leader node fails, a new leader is automatically elected
3. Clients detect leader changes and reconnect to the new leader
4. Game state is preserved through replication
