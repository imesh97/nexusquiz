import os
import uuid
import httpx
import asyncio
import hashlib
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List
import sys

if "PORT" in os.environ:
    PORT = int(os.environ["PORT"])
else:
    # fallback: try to parse from sys.argv (works with `uvicorn app:app --port 8001`)
    try:
        idx = sys.argv.index("--port") + 1
        PORT = int(sys.argv[idx])
    except:
        PORT = 8000
# ===== CONFIG =====
 # Pass this via CLI: PORT=8001 uvicorn app:app
NODE_LIST = [8000, 8001, 8002]  # Predefined ports for simplicity
NODE_URLS = [f"http://localhost:{port}" for port in NODE_LIST]
HEARTBEAT_TIMEOUT = 5  # seconds

current_leader: str = f"http://localhost:{min(NODE_LIST)}"  # Initial assumption: highest port is leader

# ===== FASTAPI SETUP =====
app = FastAPI()
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== STATE =====
questions = [
    {"id": 1, "text": "What is the capital of France?", "options": ["Madrid", "Berlin", "Paris", "Rome"], "correctIndex": 2},
    {"id": 2, "text": "What is 2 + 2?", "options": ["3", "4", "5", "6"], "correctIndex": 1},
    {"id": 3, "text": "Which planet is known as the Red Planet?", "options": ["Earth", "Mars", "Jupiter", "Venus"], "correctIndex": 1},
]
lobbies: Dict[str, dict] = {}
replica_store: Dict[str, dict] = {}
lobby_connections: Dict[str, List[WebSocket]] = {}

# ===== MODELS =====
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

# ===== UTILS =====
def get_responsible_node(key: str):
    hash_ring = sorted((int(hashlib.sha1(url.encode()).hexdigest(), 16), url) for url in NODE_URLS)
    key_hash = int(hashlib.sha1(key.encode()).hexdigest(), 16)
    for h, node in hash_ring:
        if key_hash <= h:
            return node
    return hash_ring[0][1]

async def broadcast_to_lobby(code: str, message: dict):
    if code in lobby_connections:
        for conn in lobby_connections[code]:
            await conn.send_json(message)

async def forward_to_leader(request: Request):
    async with httpx.AsyncClient() as client:
        body = await request.body()
        headers = dict(request.headers)
        method = request.method
        path = request.url.path
        response = await client.request(
            method, f"{current_leader}{path}", content=body, headers=headers,
        )
        return response

def replicate_lobby(code: str, lobby_data: dict):
    for node in NODE_URLS:
        if node != get_self_url():
            asyncio.create_task(send_replica(code, lobby_data, node))

async def send_replica(code: str, lobby_data: dict, node_url: str):
    try:
        async with httpx.AsyncClient() as client:
            await client.post(f"{node_url}/internal/replica/{code}", json=lobby_data)
    except Exception:
        print(f"[WARN] Failed to replicate to {node_url}")

def get_self_url():
    return f"http://localhost:{PORT}"

def is_leader():
    return get_self_url() == current_leader
  # Track if this node was leader/follower before

last_role = None

async def heartbeat_loop():
    global current_leader, last_role
    first_run = True

    while True:
        self_url = get_self_url()

        # ✅ Step 1: Check alive nodes (including self)
        alive = []
        for port in NODE_LIST:
            try:
                url = f"http://localhost:{port}"
                async with httpx.AsyncClient() as client:
                    res = await client.get(f"{url}/raft/heartbeat", timeout=2)
                    if res.status_code == 200:
                        alive.append(port)
            except:
                pass

        # ✅ Step 2: Determine who should be leader
        if alive:
            lowest_alive = f"http://localhost:{min(alive)}"
        else:
            lowest_alive = self_url

        # ✅ Step 3: If the current leader is dead OR there's a lower port alive → re-elect
        if current_leader not in [f"http://localhost:{p}" for p in alive] or current_leader != lowest_alive:
            print(f"[RAFT] ⚠️ Current leader down or outdated: {current_leader}")
            await asyncio.sleep(1.5)  # Small cooldown before promoting
            # double check
            alive = []
            for port in NODE_LIST:
                try:
                    url = f"http://localhost:{port}"
                    async with httpx.AsyncClient() as client:
                        res = await client.get(f"{url}/raft/heartbeat", timeout=2)
                        if res.status_code == 200:
                            alive.append(port)
                except:
                    pass
            if alive:
                lowest_alive = f"http://localhost:{min(alive)}"
            else:
                lowest_alive = self_url

            print(f"[RAFT] 🔁 New leader elected: {lowest_alive}")
            current_leader = lowest_alive

        # ✅ Step 4: Determine and log current role
        new_role = "LEADER" if self_url == current_leader else "FOLLOWER"
        if new_role != last_role or first_run:
            if new_role == "LEADER":
                print(f"[{self_url}] 🚩 I am now the LEADER")
            else:
                print(f"[{self_url}] 🧍‍♂️ I am now a FOLLOWER")
            last_role = new_role

        # ✅ Optional logging for followers
        if new_role == "FOLLOWER":
            print(f"[FOLLOWER] ✅ Leader heartbeat OK: {current_leader}")

        first_run = False
        await asyncio.sleep(HEARTBEAT_TIMEOUT)

# ===== ROUTES =====

@app.get("/lobby/state/{code}")
async def get_lobby_state(code: str):
    code = code.upper().strip()
    if code in lobbies:
        lobby = lobbies[code]
    elif code in replica_store:
        lobby = replica_store[code]
    else:
        raise HTTPException(status_code=404, detail="Lobby not found")

    return {"status": lobby["status"], "question": lobby.get("question", {})}

@app.post("/lobby/join", response_model=JoinResponse)
async def join_lobby(join_request: JoinRequest, request: Request):
    if not is_leader():
        response = await forward_to_leader(request)
        return response.json()

    code = join_request.code.upper().strip()
    nickname = join_request.nickname.strip()

    if code in lobbies:
        lobby = lobbies[code]
        if any(p["name"].lower() == nickname.lower() for p in lobby["players"]):
            raise HTTPException(status_code=400, detail="Nickname already in use")
        player_id = str(uuid.uuid4())
        lobby["players"].append({"id": player_id, "name": nickname, "score": 0})
        is_host = False
    else:
        player_id = str(uuid.uuid4())
        lobby = {
            "players": [{"id": player_id, "name": nickname, "score": 0}],
            "host": player_id,
            "status": "lobby",
            "current_question_index": -1,
        }
        lobbies[code] = lobby
        is_host = True

    replicate_lobby(code, lobby)
    await broadcast_to_lobby(code, {"event": "player_joined", "players": lobby["players"]})
    return JoinResponse(players=lobby["players"], newPlayerId=player_id, isHost=is_host)

@app.post("/lobby/start", response_model=StartGameResponse)
async def start_game(data: StartGameRequest, request: Request):
    if not is_leader():
        response = await forward_to_leader(request)
        return response.json()

    code, player_id = data.code.upper(), data.player_id
    if code not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    lobby = lobbies[code]
    if lobby["host"] != player_id:
        raise HTTPException(status_code=403, detail="Only the host can start")

    lobby["status"] = "playing"
    lobby["current_question_index"] = 0
    lobby["question"] = questions[0]
    replicate_lobby(code, lobby)
    await broadcast_to_lobby(code, {"event": "game_started", "question": questions[0]})
    return StartGameResponse(message="Game started", question=questions[0])

@app.post("/lobby/next", response_model=NextQuestionResponse)
async def next_question(data: NextQuestionRequest, request: Request):
    if not is_leader():
        response = await forward_to_leader(request)
        return response.json()

    code, player_id = data.code.upper(), data.player_id
    if code not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    lobby = lobbies[code]
    if lobby["host"] != player_id:
        raise HTTPException(status_code=403, detail="Only the host can continue")

    index = lobby.get("current_question_index", 0) + 1
    if index >= len(questions):
        await broadcast_to_lobby(code, {"event": "game_over"})
        return NextQuestionResponse(message="Game over", question={})

    lobby["current_question_index"] = index
    lobby["question"] = questions[index]
    replicate_lobby(code, lobby)
    await broadcast_to_lobby(code, {"event": "next_question", "question": questions[index]})
    return NextQuestionResponse(message="Next question", question=questions[index])

@app.post("/lobby/answer", response_model=SubmitAnswerResponse)
async def submit_answer(data: SubmitAnswerRequest, request: Request):
    if not is_leader():
        response = await forward_to_leader(request)
        return response.json()

    code = data.code.upper()
    player_id = data.player_id
    answer_index = data.answer

    if code not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    lobby = lobbies[code]
    question = lobby.get("question")
    if not question:
        raise HTTPException(status_code=400, detail="No question available")

    correct_index = question.get("correctIndex")
    is_correct = (answer_index == correct_index)

    for player in lobby["players"]:
        if player["id"] == player_id:
            if is_correct:
                player["score"] += 1
            replicate_lobby(code, lobby)
            await broadcast_to_lobby(code, {"event": "score_update", "players": lobby["players"]})
            return SubmitAnswerResponse(correct=is_correct, score=player["score"])

    raise HTTPException(status_code=404, detail="Player not found")

@app.post("/lobby/end")
async def end_game(data: EndGameRequest, request: Request):
    if not is_leader():
        return await forward_to_leader(request)

    code = data.code.upper()
    player_id = data.player_id
    if code not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    if lobbies[code]["host"] != player_id:
        raise HTTPException(status_code=403, detail="Only the host can end the game")

    await broadcast_to_lobby(code, {"event": "game_closed"})
    del lobbies[code]
    return {"message": "Game ended"}

@app.post("/internal/replica/{code}")
async def receive_replica(code: str, lobby_data: dict):
    replica_store[code.upper()] = lobby_data
    return {"status": "replicated"}

@app.websocket("/ws/{code}")
async def websocket_endpoint(websocket: WebSocket, code: str):
    code = code.upper()
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
    return {"leader_url": current_leader}

@app.get("/raft/heartbeat")
async def heartbeat():
    return {"status": "alive", "port": PORT}

@app.on_event("startup")
async def on_startup():
    global current_leader, last_role
    print(f"[NODE {PORT}] Starting RAFT heartbeat monitor...")

    # Wait a moment to let others boot up
    await asyncio.sleep(1.5)

    alive = []
    for port in NODE_LIST:
        try:
            url = f"http://localhost:{port}"
            async with httpx.AsyncClient() as client:
                res = await client.get(f"{url}/raft/heartbeat", timeout=2)
                if res.status_code == 200:
                    alive.append(port)
        except Exception:
            pass

    self_url = get_self_url()

    if alive:
        current_leader = f"http://localhost:{min(alive)}"
        print(f"[RAFT] 👑 Initial leader elected at startup: {current_leader}")
    else:
        print("[RAFT] ⚠️ No alive nodes found on startup. Defaulting to self.")
        current_leader = self_url  # 👈 ensure this is explicit!

    new_role = "LEADER" if self_url == current_leader else "FOLLOWER"
    if new_role != last_role:
        if new_role == "LEADER":
            print(f"[{self_url}]  I am now the LEADER")
        else:
            print(f"[{self_url}]  I am now a FOLLOWER")
        last_role = new_role

    asyncio.create_task(heartbeat_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=True)
