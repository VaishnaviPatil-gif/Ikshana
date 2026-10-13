import asyncio
from app.database import engine, Base
import app.auth.models
import app.spills.models
import app.vessels.models
import app.attribution.models
import app.drift.models
import app.impact.models


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables initialized successfully!")


if __name__ == "__main__":
    asyncio.run(main())
