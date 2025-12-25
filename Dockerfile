# Base image: Python + Chrome + Chromedriver + Selenium
# Check Docker Hub for latest tags if needed
FROM joyzoursky/python-chromedriver:3.9-selenium

# Set working directory
WORKDIR /app

# Copy dependency list
COPY requirements.txt .

# Install Python deps
RUN pip install --no-cache-dir -r requirements.txt

# Copy your app code
COPY . .

# Env vars
ENV PORT=8000
ENV INSTAGRAM_SESSION_FILE=/data/session_data.json

# Create directory for session file (Render disk can mount here)
RUN mkdir -p /data

# Expose port (for local/Docker clarity)
EXPOSE 8000

# Run Flask app via Gunicorn
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "180"]