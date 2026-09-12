# REC Guard — developer shortcuts
PY ?= backend/venv/bin/python

.PHONY: setup keys db backend frontend greenshield test test-backend test-frontend test-greenshield seed seed-greenshield journeys docker docker-prod clean

setup:            ## create venv, install backend + frontend deps, keys, db
	cd backend && python3.11 -m venv venv && venv/bin/pip install -r requirements.txt
	cp -n backend/.env.example backend/.env || true
	cp -n frontend/.env.example frontend/.env || true
	cd frontend && npm install
	$(MAKE) keys db

keys:             ## generate RSA-2048 key pair (once)
	cd backend && venv/bin/python scripts/generate_keys.py

db:               ## initialise the SQLite ledger
	cd backend && venv/bin/python scripts/init_db.py

backend:          ## run the Flask API on :5000
	cd backend && venv/bin/python app.py

frontend:         ## run the REC Guard Vite dev server on :5173
	cd frontend && npm run dev

greenshield:      ## run the GreenShield dev server on :5174
	cd greenshield && npm run dev

seed-greenshield: ## 12 plants, 90 days of generation, 28 RECs, 31 claims incl. the 4 fraud cases, demo users
	cd backend && venv/bin/python scripts/seed_greenshield.py --reset

journeys:         ## run the 4 demo journeys against a live API (default http://localhost:5001)
	cd backend && venv/bin/python scripts/demo_journeys.py

seed:             ## load the demo scenarios (valid + 4 fraud cases) into the ledger
	cd backend && venv/bin/python scripts/seed_demo.py

test: test-backend test-frontend test-greenshield

test-greenshield:
	cd greenshield && npm run typecheck && npm test

test-backend:
	cd backend && venv/bin/python -m pytest tests/ -q --cov=. --cov-report=term -p no:logging

test-frontend:
	cd frontend && npm test

docker:           ## dev stack on :3000 (UI) and :5000 (API)
	docker compose up --build

docker-prod:
	docker compose -f docker-compose.prod.yml up -d --build

clean:
	rm -rf backend/storage/ledger.db* backend/storage/certificates/* backend/storage/temp/* backend/htmlcov frontend/dist
