FROM node:20-bookworm

# Install system dependencies: FFmpeg, Python3, yt-dlp
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      python3-pip \
      python3-venv \
      ca-certificates \
      curl && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir yt-dlp && \
    ln -s /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy application code
COPY . .

# Create data directories (will be overridden by volume mount)
RUN mkdir -p /data/state /data/temp/downloads /data/logs

EXPOSE 3001

CMD ["node", "server.js"]
