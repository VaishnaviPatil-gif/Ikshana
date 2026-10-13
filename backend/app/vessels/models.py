from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from app.database import Base, SafeGeometry


class Vessel(Base):
    __tablename__ = "vessels"

    id = Column(Integer, primary_key=True, index=True)
    mmsi = Column(String(20), unique=True, nullable=False, index=True)
    vessel_name = Column(String(200), nullable=True)
    imo = Column(String(20), nullable=True)
    call_sign = Column(String(20), nullable=True)
    vessel_type = Column(
        String(50),
        nullable=True,
        comment="Tanker|Container|Cargo|Fishing|Passenger|Tug|Other"
    )
    length_m = Column(Float, nullable=True)
    width_m = Column(Float, nullable=True)
    draft_m = Column(Float, nullable=True)
    flag_state = Column(String(50), nullable=True)
    data_provenance = Column(String(30), nullable=True, default="seeded_demo")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Vessel {self.mmsi} {self.vessel_name}>"


class AISTrack(Base):
    __tablename__ = "ais_tracks"

    id = Column(Integer, primary_key=True, index=True)
    vessel_id = Column(Integer, ForeignKey("vessels.id"), nullable=False, index=True)
    base_datetime = Column(DateTime(timezone=True), nullable=False, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    sog = Column(Float, nullable=True, comment="Speed over ground, knots")
    cog = Column(Float, nullable=True, comment="Course over ground, degrees")
    heading = Column(Float, nullable=True)
    nav_status = Column(String(50), nullable=True)
    position = Column(SafeGeometry("POINT", srid=4326), nullable=True)
    data_provenance = Column(String(30), nullable=True, default="seeded_demo")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<AISTrack vessel={self.vessel_id} t={self.base_datetime}>"
