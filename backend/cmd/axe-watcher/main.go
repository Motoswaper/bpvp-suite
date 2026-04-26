package main

import (
    "context"
    "fmt"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    httpapi "axe-market-suite/backend/internal/api/http/router"
    "axe-market-suite/backend/internal/core/config"
    "axe-market-suite/backend/internal/core/logging"
    "axe-market-suite/backend/internal/watcher"
)

type watcherStatusAdapter struct{ svc *watcher.Service }

func (w watcherStatusAdapter) Status() map[string]any { return w.svc.Status() }

func main() {
    cfg := config.Load("axe-watcher", 8082)
    if err := cfg.Validate(); err != nil {
        panic(err)
    }
    logger, err := logging.New(cfg.LogLevel)
    if err != nil {
        panic(err)
    }
    defer logger.Sync()

    svc := watcher.New(logger, cfg.IndexerURL, cfg.EngineURL, cfg.WatchInterval, cfg.WatcherMaxSyncLagSeconds, cfg.APIKey, cfg.HMACSecret)
    stop := make(chan struct{})
    go svc.Run(stop)

    handler := httpapi.New(httpapi.Services{Watcher: watcherStatusAdapter{svc: svc}}, httpapi.SecurityConfig{APIKey: cfg.APIKey, HMACSecret: cfg.HMACSecret, TrustedCIDRs: cfg.TrustedCIDRs, RateLimitPM: cfg.RateLimitPerMinute})
    addr := fmt.Sprintf(":%d", cfg.HTTPPort)
    srv := &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second}

    go func() {
        logger.Info("axe-watcher listening")
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            panic(err)
        }
    }()

    sig := make(chan os.Signal, 1)
    signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
    <-sig

    close(stop)
    ctx, cancel := context.WithTimeout(context.Background(), time.Duration(cfg.ShutdownTimeout)*time.Second)
    defer cancel()
    _ = srv.Shutdown(ctx)
}
