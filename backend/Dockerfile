FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY . .
RUN go mod tidy && go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/axe-engine ./cmd/axe-engine
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/axe-indexer ./cmd/axe-indexer
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/axe-watcher ./cmd/axe-watcher

FROM alpine:3.22
WORKDIR /app
COPY --from=builder /bin/axe-engine /bin/axe-indexer /bin/axe-watcher /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/axe-engine"]
