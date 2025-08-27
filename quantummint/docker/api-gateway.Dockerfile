# Dockerfile for the API Gateway Service
#
# This Dockerfile uses a standard Node.js image to build and run the API gateway.
# It leverages Docker's build cache by first copying and installing dependencies
# before copying the rest of the application code.
FROM node:16-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
# The `api-gateway/` part is crucial as the context is the root of the project
COPY api-gateway/package*.json ./

# Install project dependencies
RUN npm install --omit=dev

# Copy the rest of the application code for the API Gateway and the shared libraries
COPY api-gateway/ .
COPY shared/ ../shared/

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "start"]