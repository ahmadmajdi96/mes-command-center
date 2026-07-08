# Cortanex MES — dev container
# Runs the Vite dev server exactly like `bun run dev` locally.
FROM oven/bun:1.1-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json bun.lock* bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install

# Copy the rest of the source
COPY . .

EXPOSE 8111

# Vite dev server, bound to 0.0.0.0 so it's reachable from the host
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8111"]
