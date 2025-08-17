.PHONY: help install dev build test clean docker-up docker-down

help:
	@echo "Available commands:"
	@echo "  install     - Install dependencies for all services"
	@echo "  dev         - Run all services in development mode"
	@echo "  build       - Build all services"
	@echo "  test        - Run tests for all services"
	@echo "  clean       - Clean build artifacts and node_modules"
	@echo "  docker-up   - Start all services with Docker Compose"
	@echo "  docker-down - Stop all Docker services"

install:
	@echo "Installing dependencies..."
	npm install
	npm run install:all

dev:
	@echo "Starting development servers..."
	npm run dev

build:
	@echo "Building all services..."
	npm run build

test:
	@echo "Running tests..."
	npm run test

clean:
	@echo "Cleaning build artifacts..."
	rm -rf frontend/dist frontend/.next
	rm -rf backend/dist
	rm -rf llm-service/dist
	rm -rf visualization-lib/dist
	find . -name "node_modules" -type d -exec rm -rf {} +

docker-up:
	@echo "Starting Docker services..."
	docker-compose up -d

docker-down:
	@echo "Stopping Docker services..."
	docker-compose down