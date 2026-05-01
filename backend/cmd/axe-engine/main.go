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
	"axe-market-suite/backend/internal/core/config"
	"axe-market-suite/backend/internal/core/logging"
	"axe-market-suite/backend/internal/engine"
	"axe-market-suite/backend/internal/modules/axe20"
	"axe-market-suite/backend/internal/modules/axe721"
	"axe-market-suite/backend/internal/modules/lend"
	"axe-market-suite/backend/internal/modules/market"
	"axe-market-suite/backend/internal/modules/otc"
	"axe-market-suite/backend/internal/modules/settle"
	"axe-market-suite/backend/internal/modules/trust"
)

func main() {
	cfg := config.Load("axe-engine", 8080)
	if err := cfg.Validate(); err != nil {
		panic(err)
	}
	logger, err := logging.New(cfg.LogLevel)
	if err != nil {
		panic(err)
	}
	defer logger.Sync()

	reg := engine.NewRegistry()
	reg.Register(axe20.New())
	reg.RegisterAlias("axe20", "bpvp20")
	reg.Register(axe721.New())
	reg.RegisterAlias("axe721", "bpvp721")
	reg.Register(market.New())
	reg.Register(otc.New())
	reg.Register(trust.New())
	reg.Register(lend.New())
	reg.Register(settle.New())
	journal, err := engine.NewJournal(filepath.Join(cfg.DataDir, "engine-journal.ndjson"))
	if err != nil {
		panic(err)
	}
	eng := engine.New("1.0.0-rc1", reg, journal)

	handler := httpapi.New(httpapi.Services{Engine: eng}, httpapi.SecurityConfig{APIKey: cfg.APIKey, HMACSecret: cfg.HMACSecret, TrustedCIDRs: cfg.TrustedCIDRs, RateLimitPM: cfg.RateLimitPerMinute})
	addr := fmt.Sprintf(":%d", cfg.HTTPPort)

	srv := &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		logger.Info("axe-engine listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			panic(err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(cfg.ShutdownTimeout)*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
