FROM node:18-alpine

WORKDIR /app/

COPY package*.json ./

RUN npm install

COPY * ./

RUN npm run migrations:run

ENTRYPOINT ["npm", "run", "start"]