FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
