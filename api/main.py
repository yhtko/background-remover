import io
import os
import time
from collections import defaultdict, deque

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from rembg import remove

MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg"}
RATE_LIMIT_COUNT = 3
RATE_LIMIT_WINDOW_SECONDS = 60

app = FastAPI(title="Background Remover API")
request_log: dict[str, deque[float]] = defaultdict(deque)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


def client_key(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(key: str) -> None:
    now = time.time()
    timestamps = request_log[key]
    while timestamps and now - timestamps[0] >= RATE_LIMIT_WINDOW_SECONDS:
        timestamps.popleft()

    if len(timestamps) >= RATE_LIMIT_COUNT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

    timestamps.append(now)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/remove-background")
async def remove_background(request: Request, file: UploadFile = File(...)) -> Response:
    enforce_rate_limit(client_key(request))

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only PNG and JPEG images are supported.")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Image must be 5MB or smaller.")

    if not data:
        raise HTTPException(status_code=400, detail="Image file is empty.")

    try:
        result = remove(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Background removal failed.") from exc

    return Response(
        content=io.BytesIO(result).getvalue(),
        media_type="image/png",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="background-removed.png"',
        },
    )
