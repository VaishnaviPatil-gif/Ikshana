import os
# Cap OpenMP and PyTorch worker threads to 1 to prevent memory exhaustion on cloud containers (Render 512MB RAM)
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("[INFO] Oil Spill Detection System - Starting up...")
    import asyncio
    try:
        from app.database import engine, Base
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            try:
                await conn.execute(text("ALTER TABLE spills ADD COLUMN confidence_score FLOAT DEFAULT 0.88"))
            except Exception:
                pass
            try:
                await conn.execute(text("UPDATE spills SET confidence_score = 0.88 WHERE confidence_score IS NULL"))
            except Exception:
                pass
    except Exception as e:
        print(f"[Notice] DB migration check: {e}")

    async def _seed_background():
        try:
            from app.database import async_session
            from app.auth.models import User
            from sqlalchemy import select
            async with async_session() as db:
                res = await db.execute(select(User).limit(1))
                if not res.scalars().first():
                    from scripts.seed_demo_data import seed
                    await seed(reset=False)
        except Exception as err:
            print(f"[Notice] Background seed: {err}")

    asyncio.create_task(_seed_background())

    yield
    print("[INFO] Oil Spill Detection System - Shutting down...")



app = FastAPI(
    title="Oil Spill Detection & Vessel Attribution System",
    description="Leveraging satellite imagery for oil spill detection with AIS-based vessel attribution",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
for default_origin in ("https://sarvas.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"):
    if default_origin not in origins:
        origins.append(default_origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],
)

from app.middleware.rate_limiter import RateLimitMiddleware
from app.middleware.validation import ValidationMiddleware
from app.middleware.logging_middleware import LoggingMiddleware

app.add_middleware(RateLimitMiddleware)
app.add_middleware(ValidationMiddleware)
app.add_middleware(LoggingMiddleware)

# --- Register routers ---
from app.auth.routes import router as auth_router
from app.spills.routes import router as spills_router
from app.vessels.routes import router as vessels_router
from app.drift.routes import router as drift_router
from app.attribution.routes import router as attribution_router
from app.impact.routes import router as impact_router
from app.dashboard.routes import router as dashboard_router
from app.reports.routes import router as reports_router
from app.gis_routes import router as gis_router
from app.audit.routes import router as audit_router
from app.realtime.routes import router as realtime_router
from app.ais.routes import router as ais_router
from app.qualcomm.routes import router as qualcomm_router

app.include_router(auth_router)
app.include_router(spills_router)
app.include_router(vessels_router)
app.include_router(drift_router)
app.include_router(attribution_router)
app.include_router(impact_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(gis_router)
app.include_router(audit_router)
app.include_router(realtime_router)
app.include_router(ais_router)
app.include_router(qualcomm_router)


@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"status": "ok", "service": "SARVAS Backend API", "docs": "/docs"}


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
    return {"status": "ok", "service": "oil-spill-detection"}


@app.get("/api/limitations")
async def get_limitations():
    return {
        "limitations": [
            "INVESTIGATIVE LEAD ONLY — All attribution scores represent circumstantial mathematical likelihood, not legal proof.",
            "Candidate vessels require physical maritime verification by Coast Guard boarding parties.",
            "Radar damping cannot distinguish between heavy crude oil, fuel oil, and certain biogenic films without multispectral verification.",
            "Thickness not derivable from SAR — volume estimates are not supported.",
            "AIS gaps may stem from atmospheric conditions, receiver shadow, or deliberate transponder disabling."
        ]
    }
