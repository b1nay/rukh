from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, billing, catalog, climate, inventory, land, meta, maps, notifications, payouts, requests, signup, solana
from app.core.config import settings
from app.db import Base, SessionLocal, engine
from app.migrate import add_missing_columns, convert_usd_to_sol
from app.seed import seed, seed_admin, seed_templates


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    convert_usd_to_sol(engine)
    add_missing_columns(engine)
    with SessionLocal() as db:
        seed_admin(db, settings.admin_email, settings.admin_password)
        seed_templates(db)
        if settings.seed_demo_data:
            seed(db)
    yield


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api/v1")
for module in (signup, catalog, meta, climate, land, inventory, requests, notifications, admin, billing, payouts, maps, solana):
    api.include_router(module.router)
app.include_router(api)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}
