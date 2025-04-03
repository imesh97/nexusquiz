from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import time
import random
import asyncio
import uuid
import json

HEARTBEAT_INTERVAL = 0.5  # constants for RAFT (in seconds)
ELECTION_TIMEOUT_MIN = 1.5
ELECTION_TIMEOUT_MAX = 3.0

app = FastAPI(title="Trivia Server")  # create FastAPI app

app.add_middleware(  # enable CORS (so frontend connects)
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TEMPORARY DATA MODELS (for testing)
class Player:
    def __init__(self, id, name, score=0):
        self.id = id
        self.name = name
        self.score = score
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "score": self.score
        }
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data["id"],
            name=data["name"],
            score=data.get("score", 0)
        )

class Question:
    def __init__(self, id, question, options, answer):
        self.id = id
        self.question = question
        self.options = options
        self.answer = answer
        
    def to_dict(self):
        return {
            "id": self.id,
            "question": self.question,
            "options": self.options,
            "answer": self.answer
        }
        
class Game:
    def __init__(self, id, question_id, start_time, end_time):
        self.id = id
        self.question_id = question_id
        self.start_time = start_time
        self.end_time = end_time
        
    def to_dict(self):
        return {
            "id": self.id,
            "question_id": self.question_id,
            "start_time": self.start_time,
            "end_time": self.end_time
        }
        
    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data["id"],
            question_id=data["question_id"],
            start_time=data["start_time"],
            end_time=data["end_time"]
        )

class RaftNode:
    def __init__(self, id, all_nodes):
        self.id = id
        self.all_nodes = all_nodes
        
        self.current_term = 0  # initial RAFT state
        self.voted_for = None
        self.log = []
        self.commit_index = 0
        self.last_applied = 0
        
        self.role = "follower"  # initial RAFT role
        self.leader_id = None

        self.last_heartbeat = time.time()  # initial election timer
        self.election_timeout = random.uniform(ELECTION_TIMEOUT_MIN, ELECTION_TIMEOUT_MAX)

        self.connections = {}  # id -> websocket connection

        self.players = {}  # player_id -> Player
        self.active_game = None  # initial game state

node = None  # instance for RAFT node
connected_players = {}  # track active player connections (player_id -> websocket)
questions = [  # temp question list
    Question(
        id=1,
        question="What is 9 + 10?",
        options=["19", "21", "22", "23"],
        answer="19"
    ),
    Question(
        id=2,
        question="Out of these rappers, who has the most Grammy award wins?",
        options=["Drake", "Kendrick Lamar", "Lil Wayne", "Eminem"],
        answer=["Kendrick Lamar"]
    ),
    Question(
        id=3,
        question="What is the chemical symbol for Potassium?",
        options=["Po", "Na", "Mg", "K"],
        answer=["K"]
    ),
    Question(
        id=4,
        question="Which makeup product is generally applied under the eyes?",
        options=["Foundation", "Concealer", "Bronzer", "Eyeshadow"],
        answer=["Concealer"]
    ),
    Question(
        id=5,
        question="Which country is considered an island?",
        options=["Russia", "Canada", "Kazakhstan", "Sri Lanka"],
        answer=["Sri Lanka"]
    )
]

@app.on_event("startup")
async def startup_event():
    global node

    node_id = str(uuid.uuid4())  # random UUID
    all_nodes = [node_id]  # single node setup for now

    node = RaftNode(node_id, all_nodes)  # initialize node

    # asyncio.create_task(raft_election_timer())  # background tasks (commented out for now)
    # asyncio.create_task(raft_leader_tasks())
    # asyncio.create_task(commited_entries())

@app.get("/")
async def root():
    return {"message": "Welcome to the Trivia Server!", "status": "success"}

@app.get("/status")
async def get_status():
    if not node:
        raise HTTPException(status_code=503, detail="Node not initialized")
    
    return {
        "id": node.id,
        "role": node.role,
        "leader": node.leader_id,
        "term": node.current_term,
        "players": node.players,
        "active_game": node.active_game is not None
    }

@app.get("/players")
async def get_players():
    if not node:
        raise HTTPException(status_code=503, detail="Node not initialized")
    
    return {
        "players": [player.to_dict() for player in node.players.values()]
    }

# placeholder functions for now
def append_to_log():
    pass

def notify_players():
    pass

async def start_new_game():
    pass

async def commited_entries():
    pass

@app.websocket("/ws/player")
async def ws_player(websocket: WebSocket):
    await websocket.accept()  # accept connection
    id = str(uuid.uuid4())  # random player UUID

    try:
        await websocket.send_text(json.dumps({  # send connection established message
            "type": "connection_established",
            "id": id
        }))

        while True:
            data = await websocket.receive_text()  # receive message json
            message = json.loads(data)

            if message["type"] == "join":  # handle join message
                name = message.get("name", f"Player_{id[:6]}")

                player = Player(id=id, name=name, score=0)  # create and add Player
                node.players[id] = player
                connected_players[id] = websocket

                if node.role == "leader":  # append to log if leader
                    await append_to_log()  # placeholder for now

                await websocket.send_text(json.dumps({  # send welcome message with curr state
                    "type": "welcome",
                    "player": player.to_dict(),
                    "players": [p.to_dict() for p in node.players.values()],
                    "active_game": node.active_game.to_dict() if node.active_game else None
                }))

                await notify_players()  # notify other players (placeholder for now)

            elif message["type"] == "start_game":  # handle start game message
                if node.role == "leader":  # only leader can start game
                    await start_new_game()  # placeholder for now

            elif message["type"] == "answer":  # handle answer message
                question_id = message.get("question_id")  # question and answer ids
                answer_id = message.get("answer_id")

                # check if game is active and current question matches
                if (node.active_game and node.active_game.question_id == question_id and time.time() < node.active_game.end_time):
                    question = questions[question_id]
                    correct = question.answer == answer_id  # check if answer is correct

                    if correct and id in node.players:  # if correct, update player score
                        player = node.players[id]
                        player.score += 10  # add 10 points

                        if node.role == "leader":  # append to log if leader
                            await append_to_log()  # placeholder for now
                    
                    await websocket.send_text(json.dumps({  # send update score message
                        "type": "update_score",
                        "correct": correct,
                        "score": node.players[id].score if id in node.players else 0
                    }))

                    await notify_players()  # notify other players (placeholder for now)
    
    except WebSocketDisconnect:  # handle websocket disconnect
        print(f"Player {id} disconnected")
    
    except Exception as e:  # handle general errors
        print(f"Error handling WebSocket: {e}")

    finally:
        # cleanup
        if id in connected_players:
            del connected_players[id]
        if id in node.players:
            del node.players[id]

            if node.role == "leader":  # append to log if leader
                await append_to_log()  # placeholder for now
            
            await notify_players()  # notify other players (placeholder for now)

