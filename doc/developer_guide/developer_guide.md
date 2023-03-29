## Developer guide

### Requirements

- NodeJS
- Docker

### Linting

```bash
npm run lint // Will autofix issues
npm run lint:ci // No autofix enabled
```

### Unit tests

```bash
 npm run test // Runs both test in parallel
 npm run test:dom
 npm run test:node
```

### Integration tests

```bash
 npm run itest // Runs both test in parallel
 npm run itest:dom
 npm run itest:node
```

#### MacOS

If you're using Docker Desktop, please set

```bash
export DOCKER_HOST=unix:///Users/$(whoami)/Library/Containers/com.docker.docker/Data/docker.raw.sock
```

### Testing your changes locally before publishing

You can use `npm install <directory of this project>` to install the driver locally in your other node test projects.  
Don't forget to (re)build the driver using `npm run build` to see your changes reflected.  
In case of unexplainable errors in your tests it might help to remove the entire `/dist` folder before rebuilding.
