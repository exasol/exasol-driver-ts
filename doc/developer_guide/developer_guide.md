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
