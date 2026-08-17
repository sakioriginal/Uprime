FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY relay-server.js ./
RUN mkdir -p /app/data
ENV PORT=8787 UE_SAVE_DIR=/app/data
EXPOSE 8787
CMD ["node","relay-server.js"]
