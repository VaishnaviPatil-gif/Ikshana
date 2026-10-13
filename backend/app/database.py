import socket
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings, BACKEND_DIR

db_url = settings.DATABASE_URL

if "sqlite" in db_url and "./oilspill.db" in db_url:
    db_file = BACKEND_DIR / "oilspill.db"
    db_url = db_url.replace("./oilspill.db", db_file.as_posix())

# If PostgreSQL is configured on localhost, test if port 5432 is open.
# If not open, gracefully fallback to local standalone storage so the app works out-of-the-box.
if "postgresql" in db_url and ("localhost" in db_url or "127.0.0.1" in db_url):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if sock.connect_ex(("127.0.0.1", 5432)) != 0:
            print("[Notice] Local PostgreSQL port 5432 is not active. Using local database (oilspill.db).")
            db_file = BACKEND_DIR / "oilspill.db"
            db_url = f"sqlite+aiosqlite:///{db_file.as_posix()}"
        sock.close()
    except Exception:
        pass

engine_kwargs = {"echo": False}
if "sqlite" in db_url:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(db_url, **engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


from sqlalchemy.types import TypeDecorator, Text
from geoalchemy2 import Geometry


class SafeGeometry(TypeDecorator):
    """PostGIS Geometry on PostgreSQL, Text on SQLite."""
    impl = Text
    cache_ok = True
    spatial_index = False

    def __init__(self, geometry_type="GEOMETRY", srid=4326, **kwargs):
        super().__init__()
        self.geometry_type = geometry_type
        self.srid = srid
        self.spatial_index = kwargs.get("spatial_index", False)

    def load_dialect_impl(self, dialect):
        if dialect is not None and dialect.name == "postgresql":
            return dialect.type_descriptor(Geometry(self.geometry_type, srid=self.srid))
        return dialect.type_descriptor(Text()) if dialect is not None else Text()


async def get_db():
    """Dependency: yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
