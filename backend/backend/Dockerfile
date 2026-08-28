FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for pandas, openpyxl, and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies list
COPY requirements.txt /app/

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and data files
COPY . /app/

# Environment defaults
ENV PYTHONUNBUFFERED=1
ENV NARRATOR_MODE=mock
ENV REVENUE_DB_PATH=data/final/revenue_leaks.db

# Ensure SQLite DB is built if missing
RUN python build_db.py

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
