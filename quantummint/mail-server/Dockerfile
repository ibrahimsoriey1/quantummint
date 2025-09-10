# QuantumMint Mail Server Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    openssl \
    ca-certificates \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S quantummail && \
    adduser -S quantummail -u 1001 -G quantummail

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY src/ ./src/
COPY .env.example ./

# Create necessary directories
RUN mkdir -p logs certs keys/dkim data && \
    chown -R quantummail:quantummail /app

# Generate self-signed certificates if none provided
RUN openssl req -x509 -newkey rsa:2048 -keyout certs/private.key -out certs/certificate.crt \
    -days 365 -nodes -subj "/C=US/ST=CA/L=San Francisco/O=QuantumMint/CN=mail.quantummint.com"

# Set permissions
RUN chmod 600 certs/private.key && \
    chmod 644 certs/certificate.crt && \
    chown -R quantummail:quantummail certs/

# Expose ports
EXPOSE 25 587 465 143 993 110 995 8080 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

# Switch to non-root user
USER quantummail

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
