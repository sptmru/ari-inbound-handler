FROM node:18-alpine

RUN mkdir /app
WORKDIR /app

COPY package*.json ./
COPY .env ./

RUN npm install

COPY . .

RUN npm run migrations:run

ENTRYPOINT ["npm", "run", "start"]