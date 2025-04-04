# NexusQuiz Backend

This is the FastAPI backend for the NexusQuiz real-time multiplayer trivia game. It provides REST endpoints for lobby management (join, start, next question, answer submission, and ending the game) as well as a WebSocket endpoint for real-time notifications.

## Features

- **Lobby Management:**

  - **Join Lobby:** Create or join a lobby using a unique game code and a nickname.
  - **Start Game:** Only the host can start the game, which broadcasts the first question.
  - **Next Question:** The host can trigger the next question, or end the game if there are no more questions.
  - **Answer Submission:** Players submit their answers and scores are updated (scores are sent via WebSocket or displayed at the end).
  - **End Game:** The host can end the game, which notifies all connected clients and clears the lobby.

- **Real-Time Communication:**
  - A WebSocket endpoint (`/ws/{code}`) broadcasts game events (such as player joins, game start, next question, score updates, and game over) to all clients in the lobby.

## Prerequisites

- Python 3.8 or higher

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Create a virtual environment:**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install the required dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Run the FastAPI server in development mode with automatic reload:**

   ```bash
   uvicorn main:app --reload
   ```

   The server will start on http://localhost:8000.

## API Endpoints

### POST /lobby/join

Join a lobby by providing a nickname and a game code.

Request Body:

```json
{ "nickname": "Player1", "code": "ABC123" }
```

Response:

```json
{ "players": [...], "newPlayerId": "generated-uuid", "isHost": true/false }
```

### POST /lobby/start

Start the game (host only). Broadcasts the first question to all connected clients.

Request Body:

```json
{ "code": "ABC123", "player_id": "host-uuid" }
```

### POST /lobby/next

Move to the next question (host only). If no more questions exist, broadcasts a game over event.

Request Body:

```json
{ "code": "ABC123", "player_id": "host-uuid" }
```

### POST /lobby/answer

Submit an answer for the current question.

Request Body:

```json
{ "code": "ABC123", "player_id": "player-uuid", "answer": 2 }
```

### POST /lobby/end

End the game (host only). Broadcasts a game closed event and clears the lobby.

Request Body:

```json
{ "code": "ABC123", "player_id": "host-uuid" }
```

### GET /lobby/state/{code}

Get the current lobby state including the current question.

Response:

```json
{ "status": "playing", "question": { ... } }
```

### WebSocket /ws/{code}

Connect to this endpoint to receive real-time game events (e.g., player join, game start, next question, score updates, game closed).

## Notes

- **Duplicate Nicknames:** The join endpoint prevents duplicate nicknames within a lobby (case-insensitive).
- **Player Identification:** Each player is uniquely identified by a UUID generated on join.
- **State Persistence:** The lobby state is stored in memory, so a server restart will clear all current lobbies.

## API Reference

### POST /lobby/answer

Submit an answer for the current question.

Request Body:

```json
{ "code": "ABC123", "player_id": "player-uuid", "answer": 2 }
```

### POST /lobby/end

End the game (host only). Broadcasts a game closed event and clears the lobby.

Request Body:

```json
{ "code": "ABC123", "player_id": "host-uuid" }
```

### GET /lobby/state/{code}

Get the current lobby state including the current question.

Response:

```json
{ "status": "playing", "question": { ... } }
```

### WebSocket /ws/{code}

Connect to this endpoint to receive real-time game events (e.g., player join, game start, next question, score updates, game closed).

### Notes

- **Duplicate Nicknames:** The join endpoint prevents duplicate nicknames within a lobby (case-insensitive).
- **Player Identification:** Each player is uniquely identified by a UUID generated on join.
- **State Persistence:** The lobby state is stored in memory, so a server restart will clear all current lobbies.
