from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SuspectScoreResponse(BaseModel):
    id: int
    spill_id: int
    vessel_id: int
    rank: int
    total_score: float
    proximity_score: Optional[float] = None
    time_overlap_score: Optional[float] = None
    ais_gap_score: Optional[float] = None
    speed_anomaly_score: Optional[float] = None
    course_anomaly_score: Optional[float] = None
    route_deviation_score: Optional[float] = None
    isolation_forest_score: Optional[float] = None
    confidence: Optional[float] = None
    explanation: Optional[dict] = None

    # Joined vessel info
    vessel_name: Optional[str] = None
    vessel_mmsi: Optional[str] = None
    vessel_type: Optional[str] = None
    vessel_flag: Optional[str] = None

    class Config:
        from_attributes = True


class AnomalyFlagResponse(BaseModel):
    id: int
    vessel_id: Optional[int] = None
    spill_id: Optional[int] = None
    anomaly_type: str
    detected_at: datetime
    value: Optional[float] = None
    threshold: Optional[float] = None
    description: Optional[str] = None
    acknowledged: bool
    vessel_name: Optional[str] = None
    vessel_mmsi: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
