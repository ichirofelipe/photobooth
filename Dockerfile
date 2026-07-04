# Use the exact Node version your app needs
FROM node:20.19.0

ARG RAILWAY_ENVIRONMENT

# Create app directory
WORKDIR /app

# Copy only package files first (better cache)
COPY package*.json ./

# Install dependencies
RUN rm -rf node_modules package-lock.json && \
    npm install --include=dev && \
    npm rebuild rollup

# Copy the rest of the app
COPY . .

# Build your app
RUN npm run build

# Serve with a static server
RUN npm install -g serve

# Start command
# SPA fallback + /website routing come from dist/serve.json (copied from public/),
# so the -s flag must NOT be used (it would shadow the /website static site).
CMD ["serve", "dist", "-l", "3000"]