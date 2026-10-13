from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, func
from app.database import Base, SafeGeometry


class DriftSimulation(Base):
    __tablename__ = "drift_simulations"

    id = Column(Integer, primary_key=True, index=True)
    spill_id = Column(Integer, ForeignKey("spills.id"), nullable=False, index=True)
    direction = Column(String(20), nullable=False, comment="backward|forward")
    sim_start_time = Column(DateTime(timezone=True), nullable=True)
    sim_end_time = Column(DateTime(timezone=True), nullable=True)
    duration_hours = Column(Integer, nullable=True)

    # Results as geometry
    origin_cone = Column(
        SafeGeometry("POLYGON", srid=4326),
        nullable=True,
        comment="Backward: probability cone polygon of likely origin"
    )
    predicted_path = Column(
        SafeGeometry("MULTIPOLYGON", srid=4326),
        nullable=True,
        comment="Forward: predicted slick polygon over time"
    )

    # Detailed trajectory for animation
    trajectory_points = Column(
        JSON,
        nullable=True,
        comment="Array of {time, lat, lon, probability} for animation"
    )

    # Simulation parameters used
    parameters = Column(JSON, nullable=True, comment="wind_factor, current_source, etc.")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<DriftSimulation spill={self.spill_id} dir={self.direction}>"
