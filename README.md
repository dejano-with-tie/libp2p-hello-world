# Libp2p Hello World

Just playing around with libp2p library. Application (peer) is able to perform the following action

- [ ] Search for a file by name
- [ ] Request found file for download
  - [ ] See source peer information
  - [ ] There are multiple source peers with the desired file, and I'm able to request from specific peer
- [ ] Track file download progress

## How do I run it? ##

There are multiple ways to run the application

### Using docker ###

- Build docker image
```
docker build -t libp2p-app .
```

- Run docker container
```
docker run -p 0.0.0.0:8000:8000/tcp -p 0.0.0.0:3000:3000/tcp --name p2p -it libp2p-app
```

### Using npm ###

```
npm run dev
```

Will reload on changes which is convenient for development

### Using node ###

Once ts files are transpiled, use `lib/index.js` as entry point 