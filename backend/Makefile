.PHONY: run-engine run-indexer run-watcher verify-journal build test backup-journal restore-journal smoke-gates dlq-summary self-audit

run-engine:
	go run ./cmd/axe-engine
run-indexer:
	go run ./cmd/axe-indexer
run-watcher:
	go run ./cmd/axe-watcher
verify-journal:
	docker run --rm -v "$$PWD":/app -w /app golang:1.22 sh -lc "/usr/local/go/bin/go run ./cmd/axe-verify-journal"
build:
	go build ./...
test:
	go test ./...

backup-journal:
	./scripts/backup-journal.sh

restore-journal:
	./scripts/restore-journal.sh $(FILE)

smoke-gates:
	../scripts/smoke-gates.sh

dlq-summary:
	../scripts/dlq-summary.sh $(FILE)

self-audit:
	../scripts/self-audit.sh
