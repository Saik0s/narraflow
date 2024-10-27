.PHONY: build run stop clean

build:
	docker-compose build

run:
	docker-compose up

stop:
	docker-compose down

clean:
	docker-compose down -v
	docker system prune -f

install:
	poetry install

dev:
	uvicorn app.main:app --reload

lint:
	pylint app

test:
	pytest tests
