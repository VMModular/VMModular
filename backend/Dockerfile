# Use Node.js 20 alpine as parent image
FROM node:20-alpine

# Install build dependencies for better-sqlite3 and curl for healthcheck
RUN apk add --no-cache python3 make g++ curl

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy app source
COPY . .

# Ensure data directory exists and is writable
RUN mkdir -p data && chmod 777 data

# Expose backend port
EXPOSE 4000

# Start the application
CMD ["node", "src/index.js"]
