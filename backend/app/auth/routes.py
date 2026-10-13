from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.models import User
from app.auth.schemas import UserCreate, UserLogin, UserResponse, TokenResponse
from app.auth.jwt import hash_password, verify_password, create_access_token
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user. For hackathon: open registration with role assignment."""
    # Check if username or email already taken
    existing = await db.execute(
        select(User).where((User.username == data.username) | (User.email == data.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered",
        )

    valid_roles = ["public", "coast_guard", "regional_manager", "higher_authority"]
    if data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {valid_roles}",
        )

    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        assigned_region=data.assigned_region,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate and return a JWT with role claim. Auto-provisions demo accounts if unseeded."""
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()

    DEMO_USERS = {
        "public_user": {"email": "public@demo.com", "role": "public", "region": None},
        "coast_guard": {"email": "cg@demo.com", "role": "coast_guard", "region": "west_coast"},
        "regional_mgr": {"email": "rm@demo.com", "role": "regional_manager", "region": "west_coast"},
        "authority": {"email": "auth@demo.com", "role": "higher_authority", "region": None},
    }

    # If demo user is logging in but DB wasn't seeded yet, auto-provision
    if not user and data.username in DEMO_USERS and data.password == "demo123":
        cfg = DEMO_USERS[data.username]
        user = User(
            username=data.username,
            email=cfg["email"],
            password_hash=hash_password("demo123"),
            role=cfg["role"],
            assigned_region=cfg["region"],
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except Exception:
            await db.rollback()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(
        user_id=user.id,
        role=user.role,
        region=user.assigned_region,
    )

    from app.audit.service import log_action
    import asyncio
    asyncio.create_task(log_action(
        db=db,
        user_id=user.id,
        action="login",
        resource_type="auth",
        resource_id=str(user.id),
        details={"username": user.username, "role": user.role}
    ))

    return TokenResponse(
        access_token=token,
        role=user.role,
        username=user.username,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return user
