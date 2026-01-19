# Docker File Streamlined
FROM node:25-slim
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 2053
ENV NODE_ENV=production
CMD [ "node", "app.js" ]