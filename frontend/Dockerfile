# Stage 1: Build the React application with Vite
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install all dependencies (including devDependencies required for Vite build)
RUN npm ci

# Copy frontend source code
COPY . .

# Build arguments for API and Socket.IO URLs (default to relative paths for same-origin reverse proxy)
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=/

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Build production bundle
RUN npm run build

# Stage 2: Serve compiled static assets via lightweight Nginx
FROM nginx:alpine

# Remove default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy internal Nginx SPA configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
