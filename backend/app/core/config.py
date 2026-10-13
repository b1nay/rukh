from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="RUKH_")

    app_name: str = "Rukh API"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3100"]
    # SQLite for local development; PostgreSQL/PostGIS in production.
    database_url: str = "sqlite:///./rukh.db"
    # Dummy OTP: no SMS/email is sent; this code always verifies.
    otp_dummy_code: str = "1234"
    otp_ttl_minutes: int = 10
    seed_demo_data: bool = False
    # Superadmin created at startup if no admin exists. Change both outside local dev.
    admin_email: str = "superadmin@rukh.com"
    admin_password: str = "rukh@123"
    # Payments settle in SOL. Use devnet until the platform goes live.
    solana_cluster: str = "devnet"  # devnet | testnet | mainnet-beta
    solana_rpc_url: str = "https://api.devnet.solana.com"
    # Wallet that receives Climate Partner payments. The superadmin can also set it in the app.
    solana_treasury: str | None = None


settings = Settings()
