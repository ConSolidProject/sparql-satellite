FROM node:16
WORKDIR /sparql-satellite
COPY package.json /sparql-satellite
RUN npm i 
RUN npm i -g ts-node
RUN npm i -g nodemon
COPY . /sparql-satellite