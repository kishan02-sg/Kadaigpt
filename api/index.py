"""
KadaiGPT - Vercel Serverless Entry Point
Wraps the FastAPI app for Vercel's serverless Python runtime.

Vercel deploys each request as an independent serverless function.
All /api/* routes are rewritten to this file via vercel.json.

Environment:
- VERCEL=1 is auto-set by Vercel's runtime
- DATABASE_URL should point to Supabase PostgreSQL (Transaction Pooler, port 6543)
"""

import sys
import os

# Mark as serverless environment (Vercel auto-sets VERCEL=1, but ensure it)
os.environ.setdefault("VERCEL", "1")

# Add the backend directory to Python path so app.* imports resolve
backend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import the FastAPI app — Vercel auto-detects ASGI apps
from app.main import app

# Vercel looks for the `app` variable as the ASGI handler
# No additional wrapping needed — Vercel's Python runtime natively supports ASGI
