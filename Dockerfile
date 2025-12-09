# Dockerfile

FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
# CHANGE THIS LINE
CMD ["npm", "run", "start"]
# --------------------