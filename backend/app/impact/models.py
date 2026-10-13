from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, JSON, func
from app.database import Base


class ImpactAssessment(Base):
    __tablename__ = "impact_assessments"

    id = Column(Integer, primary_key=True, index=True)
    spill_id = Column(Integer, ForeignKey("spills.id"), nullable=False, index=True)

    # Area & proximity
    affected_area_sq_km = Column(Float, nullable=True)
    coast_proximity_km = Column(Float, nullable=True)

    # Ecological overlaps
    overlaps_mpa = Column(Boolean, default=False)
    overlaps_coral = Column(Boolean, default=False)
    overlaps_eez = Column(Boolean, default=False)
    nearest_mpa_name = Column(String(200), nullable=True)
    nearest_mpa_distance_km = Column(Float, nullable=True)

    # Scoring
    priority = Column(String(20), nullable=True, comment="critical|high|medium|low")
    estimated_cleanup_cost_usd = Column(Float, nullable=True, comment="Illustrative estimate")
    ecological_sensitivity_score = Column(Float, nullable=True, comment="0-100")

    # Detailed breakdowns
    affected_regions = Column(JSON, nullable=True, comment="List of region names")
    vulnerability_details = Column(JSON, nullable=True)

    # Commercial & Natural Harm Valuation
    commercial_loss_usd = Column(Float, nullable=True)
    fisheries_loss_usd = Column(Float, nullable=True)
    port_trade_loss_usd = Column(Float, nullable=True)
    tourism_loss_usd = Column(Float, nullable=True)
    natural_loss_index = Column(Float, nullable=True)
    coral_reef_risk = Column(String(100), nullable=True)
    mangrove_risk = Column(String(100), nullable=True)
    endangered_species_threat = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<ImpactAssessment spill={self.spill_id} priority={self.priority}>"
