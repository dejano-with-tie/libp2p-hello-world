# First stage: compile things.
FROM node:lts-alpine AS build
WORKDIR /usr/src/app

# (Install OS dependencies; include -dev packages if needed.)
RUN apk add --update git build-base python3

# Install the Javascript dependencies, including all devDependencies.
COPY package.json .
RUN npm install

# Setup directories for the `node` user
#RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
# Run npm build
COPY . .
RUN npm run build

# Second stage: run
FROM node:lts-alpine
WORKDIR /usr/src/app

# (Install OS dependencies; just libraries.)
RUN apk add --update git build-base python3

# Install the Javascript dependencies, only runtime libraries.
COPY package.json .
RUN npm install --production

# Copy the dist tree from the first stage.
COPY --from=build /usr/src/app/dist dist
COPY --from=build /usr/src/app/config config

# Run the built application when the container starts.
EXPOSE 3000 8000
CMD ["npm", "run", "serve"]
#
## Install node modules
#COPY package.json ./
## Switch to the node user for installation
#USER node
#RUN npm install --production
#
## Copy over source files under the node user
#COPY --chown=node:node ./src ./src
#COPY --chown=node:node ./README.md ./
#
#EXPOSE 8000 3000
#
## Available overrides (defaults shown):
## Server logging can be enabled via the DEBUG environment variable
#CMD [ "/usr/local/bin/dumb-init", "npm", "start"]