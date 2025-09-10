FROM node:18-alpine

WORKDIR /app

# Install system dependencies for image processing
RUN apk add --no-cache \
    imagemagick \
    ghostscript

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create necessary directories
RUN mkdir -p logs uploads

# Set permissions for uploads directory
RUN chmod 755 uploads

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "src/server.js"]
