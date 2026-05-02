"""
KadaiGPT - Configuration Settings
India's First Agentic AI-Powered Retail Intelligence Platform
"Kadai" (கடை) = Shop in Tamil | GPT = Next-Gen AI

Supports deployment on:
- Vercel (serverless) with Supabase/Neon PostgreSQL
- Render.com (Docker) with PostgreSQL
- Local development with SQLite
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # App Settings
    app_name: str = "KadaiGPT"
    app_tagline: str = "AI-Powered Retail Intelligence for Bharat"
    app_env: str = "development"
    debug: bool = False
    secret_key: str = "kadaigpt-dev-secret-key-CHANGE-IN-PRODUCTION"
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./kadaigpt.db"
    
    # Supabase (optional - for direct Supabase client usage)
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_db_url: Optional[str] = None  # Direct PostgreSQL connection string
    
    # JWT Settings
    jwt_secret_key: str = "kadaigpt-dev-jwt-key-CHANGE-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    refresh_token_expire_days: int = 30
    
    # Google AI (Gemini) for OCR & Predictions
    google_api_key: Optional[str] = None
    
    # Redis (optional - gracefully degrades without it)
    redis_url: str = "redis://localhost:6379/0"
    
    # Printer Settings
    default_printer_name: str = "auto"
    silent_print_enabled: bool = True
    printer_width: int = 32
    printer_type: str = "thermal"
    
    # File Storage
    upload_dir: str = "/tmp/uploads"
    max_upload_size_mb: int = 10
    
    # API Settings
    api_v1_prefix: str = "/api/v1"
    
    # Rate Limiting
    rate_limit_per_minute: int = 100
    auth_rate_limit_per_minute: int = 5
    
    # Feature Flags
    enable_voice_commands: bool = True
    enable_multilingual: bool = True
    enable_predictive_analytics: bool = True
    enable_whatsapp_integration: bool = True
    
    # Evolution API (WhatsApp Bot) Settings
    EVOLUTION_API_URL: Optional[str] = None
    EVOLUTION_API_KEY: Optional[str] = None
    EVOLUTION_INSTANCE_NAME: str = "kadaigpt"
    WHATSAPP_VERIFY_TOKEN: str = "kadaigpt_verify_token"
    
    # Telegram Bot Settings
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    
    # Encryption
    ENCRYPTION_KEY: Optional[str] = None
    
    # Allowed Hosts (production)
    allowed_hosts: str = "localhost,127.0.0.1,kadaigpt.onrender.com,kadaigpt.vercel.app"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    @property
    def is_serverless(self) -> bool:
        """Detect if running in a serverless environment (Vercel, AWS Lambda, etc.)"""
        return bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
    
    def get_async_database_url(self) -> str:
        """
        Convert database URL to async-compatible format.
        
        Supports:
        - Supabase PostgreSQL: postgresql://...supabase.com
        - Neon PostgreSQL (Vercel): postgres://...neon.tech
        - Railway PostgreSQL: postgres://
        - Local SQLite: sqlite+aiosqlite://
        """
        url = self.database_url
        
        # Priority: SUPABASE_DB_URL > DATABASE_URL > POSTGRES_URL > default
        supabase_url = os.environ.get("SUPABASE_DB_URL")
        if supabase_url:
            url = supabase_url
        
        # Check for DATABASE_URL environment variable (Vercel/Railway/Neon/Supabase)
        if not supabase_url:
            env_url = os.environ.get("DATABASE_URL")
            if env_url:
                url = env_url
        
        # Also check POSTGRES_URL (Vercel Postgres integration)
        if not supabase_url and not os.environ.get("DATABASE_URL"):
            vercel_url = os.environ.get("POSTGRES_URL")
            if vercel_url:
                url = vercel_url
        
        # Convert postgres:// to postgresql+asyncpg://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        # Supabase and Neon require SSL - add sslmode if not present
        needs_ssl = any(domain in url for domain in ["supabase.com", "supabase.co", "neon.tech"])
        if needs_ssl and "sslmode" not in url:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}sslmode=require"
        
        return url


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
