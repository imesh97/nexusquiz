from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import time
import random

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

trivia_node = None  # instance for RAFT node
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