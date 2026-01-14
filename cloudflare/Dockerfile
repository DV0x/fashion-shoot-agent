# Fashion Shoot Agent - Cloudflare Container
# Based on Cloudflare Sandbox base image

FROM docker.io/cloudflare/sandbox:0.6.11

# Install Node.js 20 and system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ffmpeg \
    libvips-dev \
    python3 \
    make \
    g++ \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Configure for non-interactive execution (CRITICAL for containers)
ENV HOME=/root
ENV CI=true
ENV CLAUDE_CODE_SKIP_EULA=true
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
ENV TERM=dumb
ENV NO_COLOR=1

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Pre-configure Claude Code (prevents interactive prompts)
RUN mkdir -p /root/.claude && \
    echo '{"ackTosVersion": 2, "hasCompletedOnboarding": true}' > /root/.claude/settings.json

# Create directories (R2 mount point MUST exist)
RUN mkdir -p /storage /workspace
WORKDIR /workspace

# Copy sandbox dependencies and install
COPY sandbox/package.json sandbox/package-lock.json /workspace/
RUN npm ci

# Rebuild Sharp for Linux
RUN npm rebuild sharp

# Copy agent folder (skills + scripts) - copied during prebuild
COPY agent/ /workspace/agent/

# Copy sandbox code
COPY sandbox/agent-runner.ts /workspace/
COPY sandbox/orchestrator-prompt.ts /workspace/
COPY sandbox/lib/ /workspace/lib/

# DO NOT add CMD or ENTRYPOINT!
# The base image's ENTRYPOINT (/container-server/sandbox) must run
# to provide the HTTP API that sandbox.exec() communicates with

# Build version: 2 (force rebuild)
