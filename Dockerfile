# Step 1: Use a lightweight Node image
FROM node:25-slim

# Step 2: Create app directory
WORKDIR /usr/src/app

# Step 3: Copy package files first (better caching)
COPY package*.json ./

# Step 4: Install only production dependencies
RUN npm ci --only=production

# Step 5: Copy the rest of your bot code
COPY . .

EXPOSE 2053

# Step 6: Define environment variables (Can be overridden in GCP console)
ENV NODE_ENV=production

# Step 7: The command to run your bot
CMD [ "node", "app.js" ]