import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from cases.routes import router as cases_router
from lawyer.routes import router as lawyer_router
from lawyer.practice_area_routes import practice_area_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("nyaymitra.api")

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
app.include_router(cases_router)


# =========================================================
# ERROR HANDLING
#
# An unexpected failure must not hand a caller a Python stack
# trace: it can expose file paths, configuration and query
# text. The traceback is logged server-side (that is where it
# is useful) and the client gets a short, stable message.
# =========================================================

@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):  # noqa: ANN001
    logger.exception(
        "unhandled error on %s %s: %r",
        request.method,
        request.url.path,
        exc,
    )

    return JSONResponse(
        status_code=500,
        content={
            "detail": (
                "Something went wrong on the server. Please try again."
            )
        },
    )


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "message": "NyayMitra API is running"
    }
