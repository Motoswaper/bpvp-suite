package router

import (
    nethttp "net/http"
    "time"

    "axe-market-suite/backend/internal/api/http/handlers"
    "axe-market-suite/backend/internal/api/http/middleware"
    "axe-market-suite/backend/internal/core/metrics"
    "github.com/go-chi/chi/v5"
)

type Services struct {
    Engine  handlers.EngineHandlerService
    Indexer handlers.IndexerHandlerService
    Watcher handlers.WatcherHandlerService
}

type SecurityConfig struct {
    APIKey       string
    HMACSecret   string
    TrustedCIDRs []string
    RateLimitPM  int
}

func New(s Services, sec SecurityConfig) nethttp.Handler {
    metricsRegistry := metrics.NewRegistry()
    r := chi.NewRouter()
    r.Use(middleware.Recovery)
    r.Use(middleware.RequestID)
    r.Use(middleware.Logging(metricsRegistry))
    r.Use(middleware.CORS)
    r.Use(middleware.RateLimit(sec.RateLimitPM))

    h := handlers.New(s.Engine, s.Indexer, s.Watcher, metricsRegistry)

    r.Get("/health", h.Health)
    r.Get("/ready", h.Ready)
    r.Get("/status", h.Status)
    r.Get("/metrics", h.Metrics)
    r.Get("/height", h.Height)
    r.Get("/events", h.Events)
    r.Get("/state/{module}", h.State)

    r.With(
        middleware.APIKey(sec.APIKey),
        middleware.HMACSignature(sec.HMACSecret, 90*time.Second),
        middleware.TrustedCIDRs(sec.TrustedCIDRs),
    ).Post("/actions", h.Actions)

    return r
}
