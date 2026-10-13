import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://oilspill:oilspill_dev@localhost:5432/oilspill"
    DATABASE_URL_SYNC: str = "postgresql://oilspill:oilspill_dev@localhost:5432/oilspill"

    # Auth
    JWT_SECRET: str = "hackathon-oil-spill-secret-key-2024"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480  # 8 hours for demo

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    # Paths
    DATA_DIR: str = "data"
    MODEL_DIR: str = "ml/models"
    SAR_DIR: str = "data/sar"
    AIS_DIR: str = "data/ais"
    CMEMS_DIR: str = "data/cmems"
    ERA5_DIR: str = "data/era5"

    # External APIs
    AISSTREAM_API_KEY: Optional[str] = None
    CDS_API_KEY: Optional[str] = None
    QUALCOMM_API_URL: Optional[str] = None
    QUALCOMM_API_KEY: Optional[str] = None
    QUALCOMM_MODEL: Optional[str] = None

    # Drift simulation defaults
    DRIFT_BACKWARD_HOURS: int = 24
    DRIFT_FORWARD_HOURS: int = 48
    DRIFT_PARTICLE_COUNT: int = 1000

    # Anomaly detection thresholds
    SPEED_DROP_THRESHOLD: float = 2.0      # knots
    SPEED_DROP_DURATION: float = 10.0      # minutes
    COURSE_CHANGE_THRESHOLD: float = 45.0  # degrees
    AIS_GAP_THRESHOLD: float = 30.0        # minutes
    ROUTE_DEVIATION_THRESHOLD: float = 5.0 # nautical miles

    class Config:
        env_file = (str(ENV_PATH), ".env")
        case_sensitive = True
        extra = "ignore"


settings = Settings()
