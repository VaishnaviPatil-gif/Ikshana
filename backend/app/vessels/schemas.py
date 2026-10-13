from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class VesselResponse(BaseModel):
    id: int
    mmsi: str
    vessel_name: Optional[str] = None
    imo: Optional[str] = None
    call_sign: Optional[str] = None
    vessel_type: Optional[str] = None
    length_m: Optional[float] = None
    width_m: Optional[float] = None
    draft_m: Optional[float] = None
    flag_state: Optional[str] = None
    data_provenance: Optional[str] = "seeded_demo"
    created_at: datetime

    class Config:
        from_attributes = True


class AISTrackPoint(BaseModel):
    timestamp: datetime
    lat: float
    lon: float
    sog: Optional[float] = None
    cog: Optional[float] = None
    heading: Optional[float] = None
    nav_status: Optional[str] = None
    data_provenance: Optional[str] = "seeded_demo"


class VesselTrackResponse(BaseModel):
    vessel: VesselResponse
    track: List[AISTrackPoint]
    total_points: int


class VesselClassificationRow(BaseModel):
    """For Regional Manager vessel classification table."""
    vessel_type: str
    count: int
    vessel_names: List[str]
