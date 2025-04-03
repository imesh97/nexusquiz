from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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