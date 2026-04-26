package config

import (
    "fmt"
    "os"
    "strconv"
    "strings"
)

type Config struct {
    ServiceName         string
    StrictMode          bool
    HTTPPort            int
    EngineURL           string
    IndexerURL          string
    DataDir             string
    WatchInterval       int
    LogLevel            string
    ShutdownTimeout     int
    APIKey              string
    HMACSecret          string
    TrustedCIDRs        []string
    RateLimitPerMinute  int
    BitcoinMode         string
    BitcoinRPCURL       string
    BitcoinRPCUser      string
    BitcoinRPCPass      string
    BitcoinStartHeight  int64
    BitcoinConfirmations int
    IndexerMaxRetries   int
	IndexerMaxDeadLetters int
	WatcherMaxSyncLagSeconds int
}

func Load(service string, port int) Config {
    return Config{
        ServiceName:         service,
        StrictMode:          envBool("AXE_STRICT_MODE", false),
        HTTPPort:            envInt("HTTP_PORT", port),
        EngineURL:           envStr("ENGINE_URL", "http://localhost:8080"),
        IndexerURL:          envStr("INDEXER_URL", "http://localhost:8081"),
        DataDir:             envStr("AXE_DATA_DIR", "./data"),
        WatchInterval:       envInt("WATCH_INTERVAL_SECONDS", 2),
        LogLevel:            envStr("LOG_LEVEL", "info"),
        ShutdownTimeout:     envInt("SHUTDOWN_TIMEOUT_SECONDS", 15),
        APIKey:              envStr("AXE_API_KEY", ""),
        HMACSecret:          envStr("AXE_HMAC_SECRET", ""),
        TrustedCIDRs:        envList("AXE_TRUSTED_CIDRS", ""),
        RateLimitPerMinute:  envInt("AXE_RATE_LIMIT_PER_MINUTE", 240),
        BitcoinMode:         strings.ToLower(envStr("AXE_BITCOIN_MODE", "mock")),
        BitcoinRPCURL:       envStr("BITCOIN_RPC_URL", ""),
        BitcoinRPCUser:      envStr("BITCOIN_RPC_USER", ""),
        BitcoinRPCPass:      envStr("BITCOIN_RPC_PASS", ""),
        BitcoinStartHeight:  int64(envInt("BITCOIN_START_HEIGHT", 0)),
        BitcoinConfirmations: envInt("BITCOIN_CONFIRMATIONS", 2),
        IndexerMaxRetries:   envInt("INDEXER_MAX_RETRIES", 3),
		IndexerMaxDeadLetters: envInt("INDEXER_MAX_DEAD_LETTERS", 100),
		WatcherMaxSyncLagSeconds: envInt("WATCHER_MAX_SYNC_LAG_SECONDS", 300),
    }
}

func (c Config) Validate() error {
    missing := []string{}
    if c.StrictMode {
        if c.APIKey == "" {
            missing = append(missing, "AXE_API_KEY")
        }
        if c.HMACSecret == "" {
            missing = append(missing, "AXE_HMAC_SECRET")
        }
    }
    if c.BitcoinMode == "rpc" {
        if c.BitcoinRPCURL == "" {
            missing = append(missing, "BITCOIN_RPC_URL")
        }
        if c.BitcoinRPCUser == "" {
            missing = append(missing, "BITCOIN_RPC_USER")
        }
        if c.BitcoinRPCPass == "" {
            missing = append(missing, "BITCOIN_RPC_PASS")
        }
    }
    if len(missing) > 0 {
        return fmt.Errorf("config validation failed, missing: %s", strings.Join(missing, ", "))
    }
    return nil
}

func envStr(k, d string) string {
    if v := os.Getenv(k); v != "" {
        return v
    }
    return d
}

func envInt(k string, d int) int {
    v := os.Getenv(k)
    if v == "" {
        return d
    }
    n, err := strconv.Atoi(v)
    if err != nil {
        return d
    }
    return n
}

func envBool(k string, d bool) bool {
    v := os.Getenv(k)
    if v == "" {
        return d
    }
    lower := strings.ToLower(strings.TrimSpace(v))
    return lower == "1" || lower == "true" || lower == "yes" || lower == "on"
}

func envList(k, d string) []string {
    v := envStr(k, d)
    if v == "" {
        return nil
    }
    parts := strings.Split(v, ",")
    out := make([]string, 0, len(parts))
    for _, p := range parts {
        p = strings.TrimSpace(p)
        if p != "" {
            out = append(out, p)
        }
    }
    return out
}
