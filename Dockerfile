# Instruction to create the Docker Image
# alpine means add smaller version of the node image
FROM node:20.10-alpine

# please create the app directory/folder inside the container
WORKDIR /app

COPY ./package*.json ./

# Every Run command creates a layer
RUN npm install

EXPOSE 5000

CMD [ "node", "index.js" ]