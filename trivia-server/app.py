import os
import uuid
import httpx
import asyncio
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ===== RAFT SETTINGS =====
IS_LEADER = os.getenv("IS_LEADER", "false").lower() == "true"
LEADER_HOST = os.getenv("LEADER_HOST", "http://localhost:8000")

# ====== FASTAPI SETUP ======
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====== IN-MEMORY STATE ======
questions = [
    {
        "id": 1,
        "text": "What is the capital of France?",
        "options": ["Madrid", "Berlin", "Paris", "Rome"],
        "correctIndex": 2,
    },
    {
        "id": 2,
        "text": "What is 2 + 2?",
        "options": ["3", "4", "5", "6"],
        "correctIndex": 1,
    },
    {
        "id": 3,
        "text": "Which planet is known as the Red Planet?",
        "options": ["Earth", "Mars", "Jupiter", "Venus"],
        "correctIndex": 1,
    },
]
lobbies = {}
lobby_connections = {}

# ====== UTILS ======
async def heartbeat_loop():
    while True:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(f"{LEADER_HOST}/raft/heartbeat", timeout=2.0)
                if res.status_code == 200:
                    print("[FOLLOWER] Leader heartbeat OK ✅")
                else:
                    print("[FOLLOWER] Leader heartbeat failed ❌ (non-200)")
        except Exception as e:
            print("[FOLLOWER] Leader heartbeat error:", str(e))
        await asyncio.sleep(2)  # ping every 2 seconds

async def broadcast_to_lobby(code: str, message: dict):
    """Broadcast a message to all WebSocket clients in a lobby."""
    if code in lobby_connections:
        for connection in lobby_connections[code]:
            await connection.send_json(message)

def is_leader():
    return IS_LEADER

async def forward_to_leader(request: Request):
    """Forward the current request to the RAFT leader"""
    async with httpx.AsyncClient() as client:
        body = await request.body()
        headers = dict(request.headers)
        method = request.method
        path = request.url.path

        response = await client.request(
            method,
            f"{LEADER_HOST}{path}",
            content=body,
            headers=headers,
        )
        return response

# ====== MODELS ======
class JoinRequest(BaseModel):
    nickname: str
    code: str

class JoinResponse(BaseModel):
    players: list
    newPlayerId: str
    isHost: bool

class StartGameRequest(BaseModel):
    code: str
    player_id: str

class StartGameResponse(BaseModel):
    message: str
    question: dict

class NextQuestionRequest(BaseModel):
    code: str
    player_id: str

class NextQuestionResponse(BaseModel):
    message: str
    question: dict

class SubmitAnswerRequest(BaseModel):
    code: str
    player_id: str
    answer: int

class SubmitAnswerResponse(BaseModel):
    correct: bool
    score: int

class EndGameRequest(BaseModel):
    code: str
    player_id: str

# ====== ROUTES ======

@app.get("/lobby/state/{code}")
async def get_lobby_state(code: str):
    code = code.upper().strip()
    if code not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    lobby = lobbies[code]
    return {
        "status": lobby["status"],
        "question": lobby.get("question", {})
    }

@app.post("/lobby/end")
async def end_game(end_request: EndGameRequest, request: Request):
    if not is_leader():
        return await forward_to_leader(request)

    code = end_request.code.upper().strip()
    player_id = end_request.player_id.strip()
    if code not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    lobby = lobbies[code]
    if lobby.get("host") != player_id:
        raise HTTPException(status_code=403, detail="Only the host can end the game")
    
    await broadcast_to_lobby(code, {"event": "game_closed"})
    del lobbies[code]
    return {"message": "Game ended"}

@app.post("/lobby/join", response_model=JoinResponse)
async def join_lobby(join_request: JoinRequest, request: Request):
    if not is_leader():
        response = await forward_to_leader(request)
        return response.json()
    
    code = join_request.code.upper().strip()
    nickname = join_request.nickname.strip()
    if not code or not nickname:
        raise HTTPException(status_code=400, detail="Nickname and code are required")
    
    if code in lobbies:
        lobby = lobbies[code]
        if any(player["name"].lower() == nickname.lower() for player in lobby["players"]):
            raise HTTPException(status_code=400, detail="Nickname already in use")
        new_player_id = str(uuid.uuid4())
        lobby["players"].append({"id": new_player_id, "name": nickname, "score": 0})
        is_host = False
    else:
        new_player_id = str(uuid.uuid4())
        lobby = {
            "players": [{"id": new_player_id, "name": nickname, "score": 0}],
            "host": new_player_id,
            "status": "lobby",
            "current_question_index": -1,
        }
        lobbies[code] = lobby
        is_host = True

    await broadcast_to_lobby(code, {"event": "player_joined", "players": lobby["players"]})
    return JoinResponse(players=lobby["players"], newPlayerId=new_player_id, isHost=is_host)

@app.post("/lobby/start", response_model=StartGameResponse)
async def start_game(start_request: StartGameRequest, request: Request):
    if not is_leader():
        response = await forward_to_leader(request)
        return response.json()

    code = start_request.code.upper().strip()
    player_id = start_request.player_id.strip()
    if code not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    lobby = lobbies[code]
    if lobby.get("host") != player_id:
        raise HTTPException(status_code=403, detail="Only the host can start the game")
    
    lobby["status"] = "playing"
    lobby["current_question_index"] = 0
    lobby["question"] = questions[0]
    await broadcast_to_lobby(code, {"event": "game_started", "question": questions[0]})
    return StartGameResponse(message="Game started", question=questions[0])

@app.post("/lobby/next", response_model=NextQuestionResponse)
async def next_question(request_data: NextQuestionRequest, request: Request):
    if not is_leader():
        response = await forward_to_leader(request)
        return response.json()

    code = request_data.code.upper().strip()
    player_id = request_data.player_id.strip()

    if code not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    lobby = lobbies[code]
    if lobby.get("host") != player_id:
        raise HTTPException(status_code=403, detail="Only the host can trigger next question")
    if lobby.get("status") != "playing":
        raise HTTPException(status_code=400, detail="Game is not in progress")

    current_index = lobby.get("current_question_index", 0)
    new_index = current_index + 1
    if new_index >= len(questions):
        await broadcast_to_lobby(code, {"event": "game_over"})
        return NextQuestionResponse(message="No more questions", question={})

    lobby["current_question_index"] = new_index
    lobby["question"] = questions[new_index]
    await broadcast_to_lobby(code, {"event": "next_question", "question": questions[new_index]})
    return NextQuestionResponse(message="Next question started", question=questions[new_index])

@app.post("/lobby/answer", response_model=SubmitAnswerResponse)
async def submit_answer(answer_request: SubmitAnswerRequest, request: Request):
    if not is_leader():
        response = await forward_to_leader(request)
        return response.json()

    code = answer_request.code.upper().strip()
    player_id = answer_request.player_id.strip()
    answer_index = answer_request.answer

    if code not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    lobby = lobbies[code]
    if lobby.get("status") != "playing":
        raise HTTPException(status_code=400, detail="Game has not started yet")

    question = lobby.get("question")
    if not question:
        raise HTTPException(status_code=400, detail="No question available")

    correct_index = question.get("correctIndex")
    is_correct = (answer_index == correct_index)

    for player in lobby["players"]:
        if player["id"] == player_id:
            if is_correct:
                player["score"] += 1
            await broadcast_to_lobby(code, {"event": "score_update", "players": lobby["players"]})
            return SubmitAnswerResponse(correct=is_correct, score=player["score"])

    raise HTTPException(status_code=404, detail="Player not found in lobby")
@app.on_event("startup")
async def start_heartbeat_monitor():
    if not IS_LEADER:
        print("[FOLLOWER] Starting heartbeat loop to leader...")
        asyncio.create_task(heartbeat_loop())

@app.websocket("/ws/{code}")
async def websocket_endpoint(websocket: WebSocket, code: str):
    code = code.upper().strip()
    await websocket.accept()
    if code not in lobby_connections:
        lobby_connections[code] = []
    lobby_connections[code].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        lobby_connections[code].remove(websocket)

@app.get("/raft/leader")
async def get_leader():
    return {"leader_url": LEADER_HOST}

# ===== HEARTBEAT STUB =====
@app.get("/raft/heartbeat")
async def heartbeat():
    return {"status": "alive", "is_leader": IS_LEADER}


# ===== MAIN =====
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
