package axe20

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"

	"axe-market-suite/backend/internal/shared/models"
)

const (
	defaultMaxSupply   = 100_000_000.0
	defaultGenesisPlan = "ecosystem:32000000,treasury:22000000,liquidity:15000000,team:16000000,advisors:5000000,foundation:7000000,risk_reserve:3000000"
)

type State struct {
	Balances map[string]float64 `json:"balances"`
	Supply   float64            `json:"supply"`
	Metadata map[string]string  `json:"metadata"`
}

type Module struct {
	mu     sync.RWMutex
	state  State
	config moduleConfig
}

type moduleConfig struct {
	MaxSupply         float64
	AllowMintActions  bool
	AllowEventMints   bool
	GenesisAllocRaw   string
	GenesisConfigured bool
}

func New() *Module {
	cfg := moduleConfig{
		MaxSupply:         envFloat("AXE20_MAX_SUPPLY", defaultMaxSupply),
		AllowMintActions:  envBool("AXE20_ALLOW_MINT_ACTIONS", false),
		AllowEventMints:   envBool("AXE20_ALLOW_EVENT_MINTS", false),
		GenesisAllocRaw:   envStr("AXE20_GENESIS_ALLOCATIONS", defaultGenesisPlan),
		GenesisConfigured: true,
	}
	state := State{
		Balances: map[string]float64{},
		Metadata: map[string]string{
			"symbol":             "BPVP20",
			"name":               "BPVP Fungible",
			"supplyModel":        "fixed-cap-pre-minted",
			"mintPolicy":         "disabled-by-default",
			"maxSupply":          formatFloat(cfg.MaxSupply),
			"genesisAllocations": cfg.GenesisAllocRaw,
		},
	}
	m := &Module{state: state, config: cfg}
	m.applyGenesisPlan()
	return m
}

func (m *Module) Name() string { return "bpvp20" }

func (m *Module) ApplyEvent(e models.DomainEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.config.AllowEventMints {
		return nil
	}
	amt, _ := asPositiveFloat(e.Payload["amount"])
	to, _ := e.Payload["to"].(string)
	if amt <= 0 {
		amt = 1
	}
	if to == "" {
		to = "engine"
	}
	return m.creditWithCap(to, amt)
}

func (m *Module) ApplyAction(a models.Action) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	from, _ := a.Data["from"].(string)
	to, _ := a.Data["to"].(string)
	amt, _ := asPositiveFloat(a.Data["amount"])
	if amt <= 0 {
		amt = 1
	}

	switch a.Type {
	case "mint":
		if !m.config.AllowMintActions {
			return fmt.Errorf("mint disabled by policy (fixed-cap pre-minted model)")
		}
		if to == "" {
			return fmt.Errorf("mint requires to")
		}
		return m.creditWithCap(to, amt)
	case "burn":
		if from == "" {
			return fmt.Errorf("burn requires from")
		}
		if m.state.Balances[from] < amt {
			return fmt.Errorf("insufficient balance")
		}
		m.state.Balances[from] -= amt
		m.state.Supply -= amt
	case "transfer":
		if from == "" || to == "" {
			return fmt.Errorf("transfer requires from and to")
		}
		if m.state.Balances[from] < amt {
			return fmt.Errorf("insufficient balance")
		}
		m.state.Balances[from] -= amt
		m.state.Balances[to] += amt
	default:
		// Keep deterministic no-op behavior for unknown actions.
	}
	return nil
}

func (m *Module) GetState() any {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state
}

func (m *Module) applyGenesisPlan() {
	allocs, total, ok := parseAllocations(m.config.GenesisAllocRaw)
	if !ok || total <= 0 {
		m.config.GenesisConfigured = false
		m.state.Metadata["genesisStatus"] = "invalid_plan"
		return
	}
	if total > m.config.MaxSupply {
		m.config.GenesisConfigured = false
		m.state.Metadata["genesisStatus"] = "plan_exceeds_max_supply"
		return
	}
	for addr, amount := range allocs {
		m.state.Balances[addr] += amount
	}
	m.state.Supply = total
	m.state.Metadata["genesisStatus"] = "applied"
}

func (m *Module) creditWithCap(to string, amount float64) error {
	if amount <= 0 {
		return fmt.Errorf("amount must be > 0")
	}
	if m.state.Supply+amount > m.config.MaxSupply {
		return fmt.Errorf("max supply exceeded")
	}
	m.state.Balances[to] += amount
	m.state.Supply += amount
	return nil
}

func parseAllocations(raw string) (map[string]float64, float64, bool) {
	out := map[string]float64{}
	var total float64
	parts := strings.Split(raw, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		pair := strings.SplitN(part, ":", 2)
		if len(pair) != 2 {
			return nil, 0, false
		}
		addr := strings.TrimSpace(pair[0])
		amtStr := strings.TrimSpace(pair[1])
		if addr == "" || amtStr == "" {
			return nil, 0, false
		}
		amt, err := strconv.ParseFloat(amtStr, 64)
		if err != nil || amt <= 0 {
			return nil, 0, false
		}
		out[addr] += amt
		total += amt
	}
	if len(out) == 0 {
		return nil, 0, false
	}
	return out, total, true
}

func asPositiveFloat(v any) (float64, bool) {
	n, ok := v.(float64)
	if !ok || n <= 0 {
		return 0, false
	}
	return n, true
}

func envStr(k, d string) string {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		return v
	}
	return d
}

func envBool(k string, d bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(k)))
	if v == "" {
		return d
	}
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func envFloat(k string, d float64) float64 {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		return d
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil || f <= 0 {
		return d
	}
	return f
}

func formatFloat(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}
