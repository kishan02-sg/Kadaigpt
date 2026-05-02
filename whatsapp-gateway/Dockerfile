# KadaiGPT WhatsApp AI Agent
# Dockerfile for Render/Docker Deployment

FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (npm install is more forgiving than npm ci)
RUN npm install --omit=dev

# Copy app source
COPY . .

# Create auth directory
RUN mkdir -p auth_info

# Set environment variables
ENV NODE_ENV=production

# Start the bot
CMD ["node", "bot.js"]
