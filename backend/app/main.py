"""
MaintainXx Backend - FastAPI Application
"""
import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base, AsyncSessionLocal
from .ingestor import ingest_dataset
from .streamer import start_data_stream
from .routers import machines, predictions, logs, tasks, assistant, export, users, categories, work_centers, cost_optimizer

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables, ingest CMaps dataset, train ML model."""
    logger.info("🚀 MaintainXx backend starting up...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables created")

    async with AsyncSessionLocal() as db:
        await ingest_dataset(db, max_engines_per_dataset=15)

    logger.info("✅ Dataset ingested and ML model trained")
    
    # Start live streaming task
    stream_task = asyncio.create_task(start_data_stream())
    
    yield
    
    stream_task.cancel()
    logger.info("🛑 Shutting down MaintainXx backend")


app = FastAPI(
    title="MaintainXx API",
    description="Predictive Maintenance Intelligence System – powered by NASA CMAPSS data",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow Vite dev server and Vercel production frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://maintainxx.vercel.app",
        "https://frontend-two-tau-99.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(users.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(work_centers.router, prefix="/api")
app.include_router(machines.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(cost_optimizer.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "service": "MaintainXx API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "operational",
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}
