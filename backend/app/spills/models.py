from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, func
from app.database import Base, SafeGeometry


class Spill(Base):
    __tablename__ = "spills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="Auto-generated: SPILL-YYYYMMDD-NNN")
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    image_timestamp = Column(DateTime(timezone=True), nullable=True, comment="SAR capture time")

    # Coordinates & GeoJSON (DB-agnostic for instant web visualization)
    centroid_lat = Column(Float, nullable=True)
    centroid_lon = Column(Float, nullable=True)
    slick_geojson = Column(JSON, nullable=True)

    # Geometry (PostGIS / DB-agnostic)
    slick_polygon = Column(SafeGeometry("MULTIPOLYGON", srid=4326), nullable=True)
    centroid = Column(SafeGeometry("POINT", srid=4326), nullable=True)

    # Geometric characterization
    area_sq_km = Column(Float, nullable=True)
    perimeter_km = Column(Float, nullable=True)
    elongation_ratio = Column(Float, nullable=True)
    fragmentation_index = Column(Float, nullable=True, comment="Age proxy")
    age_estimate = Column(String(20), nullable=True, comment="fresh|hours|day|days")
    age_hours_min = Column(Float, nullable=True)
    age_hours_max = Column(Float, nullable=True)
    age_hours_likely = Column(Float, nullable=True)
    age_basis = Column(JSON, nullable=True)
    origin_time_earliest = Column(DateTime(timezone=True), nullable=True)
    origin_time_latest = Column(DateTime(timezone=True), nullable=True)
    origin_time_likely = Column(DateTime(timezone=True), nullable=True)
    timestamp_source = Column(String(50), nullable=True)
    georef_method = Column(String(50), nullable=True)
    georef_note = Column(String(500), nullable=True)
    pixel_size_m = Column(Float, nullable=True)
    wind_gate = Column(JSON, nullable=True)
    sar_sha256 = Column(String(64), nullable=True)
    data_provenance = Column(String(30), nullable=True, default="seeded_demo")
    severity = Column(String(20), nullable=True, comment="critical|high|medium|low")
    confidence_score = Column(Float, nullable=True, default=0.88, comment="Overall fused confidence [0.0 - 1.0]")

    # Validation workflow
    validation_status = Column(
        String(30),
        nullable=False,
        default="detected",
        comment="detected|confirmed|false_positive|needs_review"
    )
    validated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)

    # Region & imagery
    region = Column(String(100), nullable=True, index=True)
    sar_image_path = Column(String(500), nullable=True)
    mask_image_path = Column(String(500), nullable=True)
    model_confidence = Column(JSON, nullable=True, comment="Per-class probabilities")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Spill {self.name} status={self.validation_status}>"
