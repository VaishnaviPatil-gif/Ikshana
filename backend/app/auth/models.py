from sqlalchemy import Column, Integer, String, DateTime, func
from app.database import Base, SafeGeometry


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(
        String(50),
        nullable=False,
        default="public",
        comment="public | coast_guard | regional_manager | higher_authority"
    )
    assigned_region = Column(
        String(100),
        nullable=True,
        comment="Region code: west_coast, southwest_coast, southeast_coast, east_coast, andaman"
    )
    coverage_area = Column(
        SafeGeometry("POLYGON", srid=4326),
        nullable=True,
        comment="Geographic coverage polygon for coast_guard users"
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<User {self.username} role={self.role}>"
