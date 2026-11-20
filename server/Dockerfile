FROM oven/bun:latest AS base

WORKDIR /app

# DATABASE_URL is deliberately not set here. `prisma generate` runs without
# it, and a default would be baked into the image metadata. It is supplied at
# runtime by the host (Render environment) or docker-compose.

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		bash \
		build-essential \
		ca-certificates \
		curl \
		git \
		npm \
		python3 \
		python3-pip \
		python3-venv \
	&& rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

FROM base AS deps

COPY package.json package-lock.json ./
# Render runs this service with CPU inference. Prevent onnxruntime-node from
# attempting to download its optional CUDA binary during dependency install.
RUN npm_config_onnxruntime_node_install_cuda=skip npm ci --no-audit --no-fund

FROM deps AS build

COPY . .

RUN bunx prisma generate

ENV MARKITDOWN_REPO_DIR=/app/.markitdown-src
ENV MARKITDOWN_VENV_DIR=/app/.venv-markitdown

RUN sed -i 's/\r$//' /app/scripts/docker-setup-markitdown.sh /app/scripts/docker-start.sh \
	&& chmod +x /app/scripts/docker-setup-markitdown.sh /app/scripts/docker-start.sh \
	&& bash /app/scripts/docker-setup-markitdown.sh

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=8000
ENV MARKITDOWN_REPO_DIR=/app/.markitdown-src
ENV MARKITDOWN_VENV_DIR=/app/.venv-markitdown
ENV DOC_PARSER_PYTHON_PATH=/app/.venv-markitdown/bin/python
ENV DOC_PARSER_SCRIPT_PATH=/app/src/services/python/parse_document.py
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.venv-markitdown ./.venv-markitdown
COPY --from=build /app/.markitdown-src ./.markitdown-src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/modifiedprompt.ts ./modifiedprompt.ts
COPY --from=build /app/prompts.ts ./prompts.ts
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts

RUN chmod +x /app/scripts/docker-start.sh

EXPOSE 8000

CMD ["/app/scripts/docker-start.sh"]
