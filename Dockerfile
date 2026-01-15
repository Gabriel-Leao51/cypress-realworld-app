FROM node:22-bullseye

WORKDIR /app

# Evita erro "not a git repository" (husky/hooks)
ENV HUSKY=0

# Yarn via corepack (mesmo se você tiver yarn global localmente)
RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile

COPY . .

CMD ["bash", "-lc", "node render-proxy.js"]
