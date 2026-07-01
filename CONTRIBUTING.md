# Contributing

## Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac)
- Docker + Docker Compose (Linux)
- Git

## Setup

### 1. Clone the repo
```bash
git clone git@github.com:Freyjar/expenses-app.git
cd expenses-app
```

### 2.1 Set up environment
```bash
cp .env.example .env
```
The default values in `.env.example` work ot of the box with Docker - no changes needed

### 2.2 Start the app
```bash
docker compose up --build
```

First run takes a minute to build. After that:
- App: http://localhost:8000
- DB is auto-created with all tables

### 4. Create your local admin user
```bash
docker compose exec app python setup_user.py
```

Enter any username and password — this is just for local testing.

### 4. Make your changes
Files are mounted live — edits to `main.py`, `static/` etc reflect instantly without restarting Docker thanks to `--reload`.

### 5. Push when ready
```bash
git add .
git commit -m "your change description"
git push
```

## Notes
- Never commit `.env` — it's gitignored
- The local DB is isolated — won't affect production
- To reset local DB: `docker compose down -v` then `docker compose up`
