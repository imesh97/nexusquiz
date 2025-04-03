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

async def notify_players(message, exclude=None):
    message_json = json.dumps(message)  # get JSON

    for player_id, websocket in list(connected_players.items()):  # notify all players
        if exclude and player_id == exclude:  # exclude specific player
            continue

        try:
            await websocket.send_text(message_json)  # send message
        
        except Exception as e:  # handle connection errors -> remove player
            if player_id in connected_players:
                del connected_players[player_id]

async def start_new_game():
    if node.role != "leader":  # only leader can start game
        return
    
    question_id = random.randint(0, len(questions - 1))  # random question
    game_id = str(uuid.uuid4())  # random game UUID
    start_time = time.time()  # current time

    game_data = {  # create game obj
        "id": game_id,
        "question_id": question_id,
        "start_time": start_time,
        "end_time": start_time + 30
    }

    node.active_game = Game(**game_data)  # create and set active game

    await append_to_log()  # append to log (placeholder for now)

    question = questions[question_id]  # get question
    await notify_players({  # notify question to all players
        "type": "new_question",
        "question": question.question,
        "options": question.options,
        "question_id": question_id,
        "time_limit": 30
    })

    asyncio.create_task(schedule_next_game())  # schedule next question

async def schedule_next_game():
    if node.active_game:  # wait to current game to end (plus 5 seconds)
        wait_time = (node.active_game.end_time - time.time()) + 5
        if wait_time > 0:
            await asyncio.sleep(wait_time)
    
    if node.role == "leader":
        await start_new_game()

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

                await notify_players({  # notify other players
                    "type": "player_joined",
                    "player": player.to_dict()
                }, exclude=id)

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

                    await notify_players({  # notify updated scores
                        "type": "leaderboard",
                        "players": [p.to_dict() for p in node.players.values()]
                    })
    
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
            
            await notify_players({  # notify other players
                "type": "player_left",
                "player_id": id
            }, exclude=id)

@app.websocket("/ws/node/{node_id}")
async def ws_node(websocket: WebSocket, node_id: str):
    await websocket.accept()  # accept connection
    
    node.connections[node_id] = websocket  # register connection

    try:
        while True:
            data = await websocket.receive_text()  # receive message json
            message = json.loads(data)

            # handle RAFT messages
            if message["type"] == "append_entries":
                term = message.get("term", 0)  # process heartbeat/log entries
                leader_id = message.get("leader_id")

                if term >= node.current_term:  # sender's term is greater of equal -> acknowledge as leader
                    node.current_term = term
                    node.role = "follower"
                    node.leader_id = leader_id
                    node.last_heartbeat = time.time()
                    
                    entries = message.get("entries", [])  # process any entries
                    if entries:
                        node.log.extend(entries)
                        
                    await websocket.send_text(json.dumps({  # send success response
                        "type": "append_entries_response",
                        "term": node.current_term,
                        "success": True
                    }))
                else:  # our term is greater -> reject
                    await websocket.send_text(json.dumps({  # send failure response
                        "type": "append_entries_response",
                        "term": node.current_term,
                        "success": False
                    }))
            
            elif message["type"] == "request_vote":
                term = message.get("term", 0)  # process vote request
                candidate_id = message.get("candidate_id")
                last_log_index = message.get("last_log_index", -1)
                last_log_term = message.get("last_log_term", 0)

                grant_vote = False
                
                if term > node.current_term:  # sender's term is greater -> become follower
                    node.current_term = term
                    node.voted_for = None
                    node.role = "follower"
                
                if (node.voted_for is None or node.voted_for == candidate_id) and term >= node.current_term:  # check if voted for candidate
                    last_log_term_x = node.log[-1].get("term", 0) if node.log else 0  # get last log term and index
                    last_log_index_x = len(node.log) - 1

                    if (last_log_term > last_log_term_x or (last_log_term == last_log_term_x and last_log_index >= last_log_index_x)):  # check if candidate log is up to date
                        grant_vote = True  # grant vote
                        node.voted_for = candidate_id
                        node.last_heartbeat = time.time()  # reset timeout when voting
                
                await websocket.send_text(json.dumps({  # send request vote response
                    "type": "request_vote_response",
                    "term": node.current_term,
                    "vote_granted": grant_vote
                }))
    
    except Exception as e:  # handle general errors
        print(f"Error handling WebSocket: {e}")

    finally:
        # cleanup
        if node_id in node.connections:
            del node.connections[node_id]

async def start_election():
    node.role = "candidate"  # become candidate
    node.current_term += 1  # increment term
    node.voted_for = node.id  # vote for self
    print(f"{node.id} starting election in term {node.current_term}")

    node.election_timeout = random.uniform(ELECTION_TIMEOUT_MIN, ELECTION_TIMEOUT_MAX)  # random election timeout
    node.last_heartbeat = time.time()

    votes = 1  # count votes
    for id in node.all_nodes:
        if id == node.id:  # skip self
            continue
        
        if id in node.connections:  # check if connection exists
            try:
                ws = node.connections[id]  # get connection
                await ws.send_text(json.dumps({  # send request vote
                    "type": "request_vote",
                    "term": node.current_term,
                    "candidate_id": node.id,
                    "last_log_index": len(node.log) - 1 if node.log else -1,
                    "last_log_term": node.log[-1].get("term", 0) if node.log else 0
                }))

                response = await ws.receive_text()  # receive response data
                data = json.loads(response)
                if data.get("vote_granted"):
                    votes += 1  # increment votes

            except Exception as e:  # handle errors
                print(f"Error sending request vote to {id}: {e}")

    if votes > len(node.all_nodes) // 2:  # become leader if majority
        await become_leader()


async def raft_election_timer():
    while True:
        if node.role in ["follower", "candidate"]:  # check if follower or candidate
            last_heartbeat_since = time.time() - node.last_heartbeat
            if last_heartbeat_since > node.election_timeout:  # check if timeout
                await start_election()  # start election

        await asyncio.sleep(0.1)  # check every 100ms

async def become_leader():
    print(f"Node {node.id} won election in term {node.current_term}")
    node.role = "leader"  # become leader
    node.leader_id = node.id  # set leader id
    node.last_heartbeat = time.time()  # reset heartbeat

    await notify_players(
        {"type": "new_leader", "leader_id": node.id}
        )  # notify other nodes

    await start_new_game()  # start new game

async def raft_leader_tasks():
    while True:
        if node.role == "leader":
            for id in node.all_nodes:  # send heartbeat to all followers
                if id == node.id:  # skip self
                    continue
                
                if id in node.connections:  # check if connection exists
                    try:
                        ws = node.connections[id]  # get connection
                        await ws.send_text(json.dumps({  # send append entries
                            "type": "append_entries",
                            "term": node.current_term,
                            "leader_id": node.id,
                            "entries": []  # heartbeat (empty entries)
                        }))
                    
                    except Exception as e:  # handle errors
                        print(f"Error sending append entries to {id}: {e}")
                    
                await asyncio.sleep(HEARTBEAT_INTERVAL)  # heartbeat interval
        else:  # follower or candidate
            await asyncio.sleep(0.1)  # check every 100ms