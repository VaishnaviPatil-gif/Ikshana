from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, JSON, func
from app.database import Base


class SuspectScore(Base):
    __tablename__ = "suspect_scores"

    id = Column(Integer, primary_key=True, index=True)
    spill_id = Column(Integer, ForeignKey("spills.id"), nullable=False, index=True)
    vessel_id = Column(Integer, ForeignKey("vessels.id"), nullable=False, index=True)
    rank = Column(Integer, nullable=False, comment="1=most suspect")

    # Composite score
    total_score = Column(Float, nullable=False, comment="0-100 weighted sum")

    # Individual factor scores (0-100 each, before weighting)
    proximity_score = Column(Float, nullable=True)
    time_overlap_score = Column(Float, nullable=True)
    ais_gap_score = Column(Float, nullable=True)
    speed_anomaly_score = Column(Float, nullable=True)
    course_anomaly_score = Column(Float, nullable=True)
    route_deviation_score = Column(Float, nullable=True)

    # IsolationForest raw anomaly score (0-1)
    isolation_forest_score = Column(Float, nullable=True)

    # Confidence in the attribution (0-1)
    confidence = Column(Float, nullable=True)

    # Human-readable per-factor explanation
    explanation = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<SuspectScore spill={self.spill_id} vessel={self.vessel_id} rank={self.rank}>"


class AnomalyFlag(Base):
    __tablename__ = "anomaly_flags"

    id = Column(Integer, primary_key=True, index=True)
    vessel_id = Column(Integer, ForeignKey("vessels.id"), nullable=True, index=True)
    spill_id = Column(Integer, ForeignKey("spills.id"), nullable=True, index=True)
    anomaly_type = Column(
        String(50),
        nullable=False,
        comment="speed_drop|course_change|ais_gap|route_deviation"
    )
    detected_at = Column(DateTime(timezone=True), nullable=False)
    value = Column(Float, nullable=True, comment="e.g., speed value or gap duration in minutes")
    threshold = Column(Float, nullable=True, comment="Threshold that was exceeded")
    description = Column(String(500), nullable=True)
    acknowledged = Column(Boolean, default=False, comment="For notification feed")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<AnomalyFlag {self.anomaly_type} vessel={self.vessel_id}>"


class AttributionRun(Base):
    __tablename__ = "attribution_runs"

    id = Column(Integer, primary_key=True, index=True)
    spill_id = Column(Integer, ForeignKey("spills.id"), nullable=False, index=True)
    run_at = Column(DateTime(timezone=True), server_default=func.now())
    origin_time_start = Column(DateTime(timezone=True), nullable=True)
    origin_time_end = Column(DateTime(timezone=True), nullable=True)
    origin_window_source = Column(String(100), nullable=True)
    cone_source = Column(String(100), nullable=True)
    origin_lat = Column(Float, nullable=True)
    origin_lon = Column(Float, nullable=True)
    cone_geojson = Column(JSON, nullable=True)
    vessels_in_window = Column(Integer, nullable=True)
    vessels_candidates = Column(Integer, nullable=True)
    vessels_filtered = Column(Integer, nullable=True)
    filtered_out = Column(JSON, nullable=True)
    parameters = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<AttributionRun spill={self.spill_id} candidates={self.vessels_candidates}>"
