#!/bin/bash
# KadaiGPT start script - works on Render, Railway, Fly.io
exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
