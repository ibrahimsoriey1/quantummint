# Dockerfile for the Frontend Application (Multi-stage build)
#
# Stage 1: Build the React application
FROM node:16-alpine as builder

WORKDIR /app

COPY frontend/package*.json ./

# Install dependencies and build the React app
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Serve the built application with Nginx
# This creates a minimal image for production by only including the necessary static files.
FROM nginx:alpine

# Copy the Nginx configuration file
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built React app from the 'builder' stage into the Nginx web root
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port 80 to serve the web application
EXPOSE 80

# The default Nginx CMD will serve the static files
CMD ["nginx", "-g", "daemon off;"]