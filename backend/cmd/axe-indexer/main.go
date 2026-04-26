package main

import (
    "context"
    "fmt"
    "net/http"
    "os"
    "os/signal"
    "path/filepath"
    "syscall"
    "time"

    httpapi "axe-market-suite/backend/internal/api/http/router"
    "axe-market-suite/backend/internal/core/bitcoin"
    "axe-market-suite/backend/internal/core/config"
    "axe-market-suite/backend/internal/core/logging"
    "axe-market-suite/backend/internal/indexer"
)

func main() {
    cfg := config.Load("axe-indexer", 8081)
    if err := cfg.Validate(); err != nil {
        panic(err)
    }
    logger, err := logging.New(cfg.LogLevel)
    if err != nil {
        panic(err)
    }
    defer logger.Sync()

    var btc bitcoin.Client
    if cfg.BitcoinMode == "rpc" {
        btc = bitcoin.NewRPCClient(cfg.BitcoinRPCURL, cfg.BitcoinRPCUser, cfg.BitcoinRPCPass)
    } else {
        btc = bitcoin.NewMockClient()
    }

    checkpointPath := filepath.Join(cfg.DataDir, "indexer-checkpoint.json")
    deadLetterPath := filepath.Join(cfg.DataDir, "indexer-dead-letter.ndjson")
    svc := indexer.New(btc, checkpointPath, deadLetterPath, cfg.BitcoinConfirmations, cfg.IndexerMaxRetries, cfg.IndexerMaxDeadLetters, cfg.BitcoinStartHeight)
    stop := make(chan struct{})
    go svc.Run(stop)

    handler := httpapi.New(httpapi.Services{Indexer: svc}, httpapi.SecurityConfig{APIKey: cfg.APIKey, HMACSecret: cfg.HMACSecret, TrustedCIDRs: cfg.TrustedCIDRs, RateLimitPM: cfg.RateLimitPerMinute})
    addr := fmt.Sprintf(":%d", cfg.HTTPPort)
    srv := &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second}

    go func() {
        logger.Info("axe-indexer listening",)
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
