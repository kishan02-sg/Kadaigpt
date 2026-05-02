# KadaiGPT - Multi-stage Dockerfile
# Builds React frontend + Python backend in a single container
# Works with Render, Railway, Fly.io, or any Docker host

# ── Stage 1: Build React Frontend ──
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python Backend + Serve Frontend ──
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (cache layer)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Set working directory to backend
WORKDIR /app/backend

# Make start script executable
RUN chmod +x start.sh

# Environment
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

# Start the app
CMD ["bash", "start.sh"]
