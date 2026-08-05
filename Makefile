.PHONY: dev build start db-up db-down db-migrate

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

db-up:
	docker-compose up -d

db-down:
	docker-compose down

db-migrate:
	npx prisma migrate dev
