from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from lawyer.routes import router as lawyer_router
from lawyer.practice_area_routes import practice_area_router


app = FastAPI(
    title="NyayMitra API",
    description="Backend API for the NyayMitra application",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# ROUTERS
# =========================================================

app.include_router(lawyer_router)
app.include_router(practice_area_router)


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "message": "NyayMitra API is running"
    }