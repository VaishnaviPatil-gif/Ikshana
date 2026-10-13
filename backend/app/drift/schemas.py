from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DriftPointSchema(BaseModel):
    time: str
    lat: float
    lon: float
    probability: Optional[float] = None


class DriftSimulationResponse(BaseModel):
    id: int
    spill_id: int
    direction: str
    sim_start_time: Optional[datetime] = None
    sim_end_time: Optional[datetime] = None
    duration_hours: Optional[int] = None
    origin_cone_geojson: Optional[dict] = None
    contour_50_geojson: Optional[dict] = None
    contour_90_geojson: Optional[dict] = None
    origin_heatmap_geojson: Optional[dict] = None
    predicted_path_geojson: Optional[dict] = None
    trajectory_points: Optional[List[dict]] = None
    parameters: Optional[dict] = None
    forcing_timeline: Optional[List[dict]] = None
    data_provenance: Optional[str] = "seeded_demo"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
