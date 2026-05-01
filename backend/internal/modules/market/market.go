package market

import (
	"fmt"
	"math"
	"sync"
	"time"

	"axe-market-suite/backend/internal/shared/models"
)

type Order struct {
	ID     string  `json:"id"`
	Side   string  `json:"side"`
	Price  float64 `json:"price"`
	Amount float64 `json:"amount"`
}

type AMMState struct {
	Enabled          bool                   `json:"enabled"`
	Token0           string                 `json:"token0"`
	Token1           string                 `json:"token1"`
	Reserve0         float64                `json:"reserve0"`
	Reserve1         float64                `json:"reserve1"`
	FeeBps           float64                `json:"feeBps"`
	TotalLiquidity   float64                `json:"totalLiquidity"`
	Positions        map[string]float64     `json:"positions"`
	VolumeToken0     float64                `json:"volumeToken0"`
	VolumeToken1     float64                `json:"volumeToken1"`
	SwapCount        int64                  `json:"swapCount"`
	LastPriceToken1  float64                `json:"lastPriceToken1"`
	UpdatedAt        string                 `json:"updatedAt"`
	Policy           AMMPolicy              `json:"policy"`
	Guardrails       AMMGuardrails          `json:"guardrails"`
	PriceHistory     []PricePoint           `json:"priceHistory"`
	TraderLimits     map[string]TraderLimit `json:"traderLimits"`
	TraderStats      map[string]TraderStats `json:"traderStats"`
	RecentExecutions []ExecutionRecord      `json:"recentExecutions"`
	UsedNonces       map[string]int64       `json:"usedNonces"`
}

type AMMPolicy struct {
	MaxPriceImpactBps         float64 `json:"maxPriceImpactBps"`
	MaxSwapInRatioBps         float64 `json:"maxSwapInRatioBps"`
	TwapWindowSeconds         int64   `json:"twapWindowSeconds"`
	TwapMaxDeviationBps       float64 `json:"twapMaxDeviationBps"`
	CircuitBreakerEnabled     bool    `json:"circuitBreakerEnabled"`
	CircuitBreakerCooldownSec int64   `json:"circuitBreakerCooldownSec"`
	NonceWindowSeconds        int64   `json:"nonceWindowSeconds"`
}

type AMMGuardrails struct {
	CircuitBreakerTripped   bool    `json:"circuitBreakerTripped"`
	CircuitBreakerReason    string  `json:"circuitBreakerReason"`
	CircuitBreakerTrippedAt string  `json:"circuitBreakerTrippedAt"`
	LastPriceImpactBps      float64 `json:"lastPriceImpactBps"`
	LastTwapPrice           float64 `json:"lastTwapPrice"`
	LastDeviationBps        float64 `json:"lastDeviationBps"`
}

type PricePoint struct {
	TS          int64   `json:"ts"`
	PriceToken1 float64 `json:"priceToken1"`
}

type TraderLimit struct {
	MaxNotionalPerWindowToken0 float64 `json:"maxNotionalPerWindowToken0"`
	WindowSeconds              int64   `json:"windowSeconds"`
}

type TraderStats struct {
	WindowStartTS    int64   `json:"windowStartTs"`
	WindowUsedToken0 float64 `json:"windowUsedToken0"`
	TotalSwaps       int64   `json:"totalSwaps"`
}

type ExecutionRecord struct {
	TS               int64   `json:"ts"`
	Trader           string  `json:"trader"`
	TokenIn          string  `json:"tokenIn"`
	AmountIn         float64 `json:"amountIn"`
	AmountOut        float64 `json:"amountOut"`
	PriceImpactBps   float64 `json:"priceImpactBps"`
	TwapDeviationBps float64 `json:"twapDeviationBps"`
	Status           string  `json:"status"`
	Reason           string  `json:"reason,omitempty"`
}

type State struct {
	Bids   []Order  `json:"bids"`
	Asks   []Order  `json:"asks"`
	Trades []string `json:"trades"`
	AMM    AMMState `json:"amm"`
}

type Module struct {
	mu    sync.RWMutex
	state State
}

func New() *Module {
	return &Module{
		state: State{
			Bids:   []Order{},
			Asks:   []Order{},
			Trades: []string{},
			AMM: AMMState{
				Enabled:   false,
				Token0:    "BTC",
				Token1:    "BPVP",
				FeeBps:    30,
				Positions: map[string]float64{},
				UpdatedAt: time.Now().UTC().Format(time.RFC3339),
				Policy: AMMPolicy{
					MaxPriceImpactBps:         1200,
					MaxSwapInRatioBps:         1500,
					TwapWindowSeconds:         300,
					TwapMaxDeviationBps:       1800,
					CircuitBreakerEnabled:     true,
					CircuitBreakerCooldownSec: 180,
					NonceWindowSeconds:        180,
				},
				PriceHistory:     []PricePoint{},
				TraderLimits:     map[string]TraderLimit{},
				TraderStats:      map[string]TraderStats{},
				RecentExecutions: []ExecutionRecord{},
				UsedNonces:       map[string]int64{},
			},
		},
	}
}

func (m *Module) Name() string { return "market" }

func (m *Module) ApplyEvent(e models.DomainEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.state.Trades = append(m.state.Trades, e.TxID)
	return nil
}

func asNumber(v any) (float64, bool) {
	n, ok := v.(float64)
	if !ok {
		return 0, false
	}
	return n, true
}

func asString(v any) (string, bool) {
	s, ok := v.(string)
	if !ok {
		return "", false
	}
	return s, true
}

func (m *Module) applyLegacyOrder(a models.Action) {
	o := Order{ID: a.Type, Side: "buy", Price: 1, Amount: 1}
	if s, ok := asString(a.Data["side"]); ok {
		o.Side = s
	}
	if p, ok := asNumber(a.Data["price"]); ok {
		o.Price = p
	}
	if q, ok := asNumber(a.Data["amount"]); ok {
		o.Amount = q
	}
	if o.Side == "buy" {
		m.state.Bids = append(m.state.Bids, o)
	} else {
		m.state.Asks = append(m.state.Asks, o)
	}
}

func (m *Module) touchAMM() {
	m.state.AMM.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if m.state.AMM.Reserve0 > 0 {
		m.state.AMM.LastPriceToken1 = m.state.AMM.Reserve1 / m.state.AMM.Reserve0
		now := time.Now().Unix()
		m.state.AMM.PriceHistory = append(m.state.AMM.PriceHistory, PricePoint{
			TS:          now,
			PriceToken1: m.state.AMM.LastPriceToken1,
		})
		cutoff := now - int64(math.Max(60, float64(m.state.AMM.Policy.TwapWindowSeconds*3)))
		filtered := make([]PricePoint, 0, len(m.state.AMM.PriceHistory))
		for _, p := range m.state.AMM.PriceHistory {
			if p.TS >= cutoff {
				filtered = append(filtered, p)
			}
		}
		m.state.AMM.PriceHistory = filtered
	}
}

func (m *Module) tripCircuitBreaker(reason string) {
	m.state.AMM.Guardrails.CircuitBreakerTripped = true
	m.state.AMM.Guardrails.CircuitBreakerReason = reason
	m.state.AMM.Guardrails.CircuitBreakerTrippedAt = time.Now().UTC().Format(time.RFC3339)
}

func (m *Module) maybeRecoverCircuitBreaker() {
	if !m.state.AMM.Guardrails.CircuitBreakerTripped {
		return
	}
	trippedAt, err := time.Parse(time.RFC3339, m.state.AMM.Guardrails.CircuitBreakerTrippedAt)
	if err != nil {
		return
	}
	cooldown := time.Duration(m.state.AMM.Policy.CircuitBreakerCooldownSec) * time.Second
	if time.Since(trippedAt) >= cooldown {
		m.state.AMM.Guardrails.CircuitBreakerTripped = false
		m.state.AMM.Guardrails.CircuitBreakerReason = ""
		m.state.AMM.Guardrails.CircuitBreakerTrippedAt = ""
	}
}

func (m *Module) computeTWAP(now int64) float64 {
	window := m.state.AMM.Policy.TwapWindowSeconds
	points := m.state.AMM.PriceHistory
	if window <= 0 || len(points) == 0 {
		return m.state.AMM.LastPriceToken1
	}
	cutoff := now - window
	if len(points) == 1 {
		return points[0].PriceToken1
	}

	totalWeight := float64(0)
	weighted := float64(0)
	for i := 0; i < len(points)-1; i++ {
		start := points[i].TS
		end := points[i+1].TS
		if end <= cutoff {
			continue
		}
		if start < cutoff {
			start = cutoff
		}
		if end <= start {
			continue
		}
		weight := float64(end - start)
		totalWeight += weight
		weighted += points[i].PriceToken1 * weight
	}
	last := points[len(points)-1]
	if last.TS < now {
		start := last.TS
		if start < cutoff {
			start = cutoff
		}
		if now > start {
			weight := float64(now - start)
			totalWeight += weight
			weighted += last.PriceToken1 * weight
		}
	}
	if totalWeight == 0 {
		return m.state.AMM.LastPriceToken1
	}
	return weighted / totalWeight
}

func (m *Module) setPolicy(a models.Action) error {
	if v, ok := asNumber(a.Data["maxPriceImpactBps"]); ok && v > 0 {
		m.state.AMM.Policy.MaxPriceImpactBps = v
	}
	if v, ok := asNumber(a.Data["maxSwapInRatioBps"]); ok && v > 0 {
		m.state.AMM.Policy.MaxSwapInRatioBps = v
	}
	if v, ok := asNumber(a.Data["twapWindowSeconds"]); ok && v >= 30 {
		m.state.AMM.Policy.TwapWindowSeconds = int64(v)
	}
	if v, ok := asNumber(a.Data["twapMaxDeviationBps"]); ok && v > 0 {
		m.state.AMM.Policy.TwapMaxDeviationBps = v
	}
	if v, ok := a.Data["circuitBreakerEnabled"].(bool); ok {
		m.state.AMM.Policy.CircuitBreakerEnabled = v
	}
	if v, ok := asNumber(a.Data["circuitBreakerCooldownSec"]); ok && v >= 30 {
		m.state.AMM.Policy.CircuitBreakerCooldownSec = int64(v)
	}
	if v, ok := asNumber(a.Data["nonceWindowSeconds"]); ok && v >= 30 {
		m.state.AMM.Policy.NonceWindowSeconds = int64(v)
	}
	m.touchAMM()
	return nil
}

func (m *Module) validateNonce(a models.Action) error {
	nonce, _ := asString(a.Data["nonce"])
	nonceTsRaw, ok := asNumber(a.Data["nonceTs"])
	if nonce == "" || !ok {
		return fmt.Errorf("nonce and nonceTs are required")
	}
	nonceTs := int64(nonceTsRaw)
	now := time.Now().Unix()
	window := m.state.AMM.Policy.NonceWindowSeconds
	if window < 30 {
		window = 180
	}
	if nonceTs < now-window || nonceTs > now+window {
		return fmt.Errorf("stale nonce timestamp")
	}
	if _, exists := m.state.AMM.UsedNonces[nonce]; exists {
		return fmt.Errorf("nonce already used")
	}
	m.state.AMM.UsedNonces[nonce] = nonceTs
	cutoff := now - window
	for key, ts := range m.state.AMM.UsedNonces {
		if ts < cutoff {
			delete(m.state.AMM.UsedNonces, key)
		}
	}
	return nil
}

func (m *Module) setTraderLimit(a models.Action) error {
	trader, _ := asString(a.Data["trader"])
	if trader == "" {
		return fmt.Errorf("trader is required")
	}
	maxNotional, ok := asNumber(a.Data["maxNotionalPerWindowToken0"])
	if !ok || maxNotional <= 0 {
		return fmt.Errorf("invalid maxNotionalPerWindowToken0")
	}
	window, ok := asNumber(a.Data["windowSeconds"])
	if !ok || window < 30 {
		return fmt.Errorf("invalid windowSeconds")
	}
	m.state.AMM.TraderLimits[trader] = TraderLimit{
		MaxNotionalPerWindowToken0: maxNotional,
		WindowSeconds:              int64(window),
	}
	return nil
}

func (m *Module) resetCircuitBreaker() {
	m.state.AMM.Guardrails.CircuitBreakerTripped = false
	m.state.AMM.Guardrails.CircuitBreakerReason = ""
	m.state.AMM.Guardrails.CircuitBreakerTrippedAt = ""
}

func (m *Module) initPool(a models.Action) error {
	token0, _ := asString(a.Data["token0"])
	token1, _ := asString(a.Data["token1"])
	provider, _ := asString(a.Data["provider"])
	if token0 == "" {
		token0 = "BTC"
	}
	if token1 == "" {
		token1 = "BPVP"
	}
	if provider == "" {
		provider = "system"
	}
	amount0, ok0 := asNumber(a.Data["amount0"])
	amount1, ok1 := asNumber(a.Data["amount1"])
	if !ok0 || !ok1 || amount0 <= 0 || amount1 <= 0 {
		return fmt.Errorf("invalid pool initialization amounts")
	}
	if m.state.AMM.Enabled {
		return fmt.Errorf("amm pool already initialized")
	}
	liq := math.Sqrt(amount0 * amount1)
	m.state.AMM.Enabled = true
	m.state.AMM.Token0 = token0
	m.state.AMM.Token1 = token1
	m.state.AMM.Reserve0 = amount0
	m.state.AMM.Reserve1 = amount1
	m.state.AMM.TotalLiquidity = liq
	m.state.AMM.Positions[provider] = liq
	m.touchAMM()
	return nil
}

func (m *Module) addLiquidity(a models.Action) error {
	if !m.state.AMM.Enabled {
		return fmt.Errorf("amm pool not initialized")
	}
	provider, _ := asString(a.Data["provider"])
	if provider == "" {
		provider = "system"
	}
	amount0, ok0 := asNumber(a.Data["amount0"])
	amount1, ok1 := asNumber(a.Data["amount1"])
	if !ok0 || !ok1 || amount0 <= 0 || amount1 <= 0 {
		return fmt.Errorf("invalid liquidity amounts")
	}
	expected1 := amount0 * m.state.AMM.Reserve1 / m.state.AMM.Reserve0
	if expected1 > 0 {
		relativeDiff := math.Abs(amount1-expected1) / expected1
		if relativeDiff > 0.02 {
			return fmt.Errorf("deposit ratio out of range")
		}
	}
	minted0 := amount0 * m.state.AMM.TotalLiquidity / m.state.AMM.Reserve0
	minted1 := amount1 * m.state.AMM.TotalLiquidity / m.state.AMM.Reserve1
	minted := math.Min(minted0, minted1)
	if minted <= 0 {
		return fmt.Errorf("minted liquidity is zero")
	}
	m.state.AMM.Reserve0 += amount0
	m.state.AMM.Reserve1 += amount1
	m.state.AMM.TotalLiquidity += minted
	m.state.AMM.Positions[provider] += minted
	m.touchAMM()
	return nil
}

func (m *Module) removeLiquidity(a models.Action) error {
	if !m.state.AMM.Enabled || m.state.AMM.TotalLiquidity <= 0 {
		return fmt.Errorf("amm pool not initialized")
	}
	provider, _ := asString(a.Data["provider"])
	if provider == "" {
		provider = "system"
	}
	liq, ok := asNumber(a.Data["liquidity"])
	if !ok || liq <= 0 {
		return fmt.Errorf("invalid liquidity amount")
	}
	if m.state.AMM.Positions[provider] < liq {
		return fmt.Errorf("insufficient provider liquidity")
	}
	share := liq / m.state.AMM.TotalLiquidity
	out0 := share * m.state.AMM.Reserve0
	out1 := share * m.state.AMM.Reserve1
	m.state.AMM.Reserve0 -= out0
	m.state.AMM.Reserve1 -= out1
	m.state.AMM.TotalLiquidity -= liq
	m.state.AMM.Positions[provider] -= liq
	if m.state.AMM.Positions[provider] <= 0 {
		delete(m.state.AMM.Positions, provider)
	}
	m.touchAMM()
	return nil
}

func (m *Module) swapExactIn(a models.Action) error {
	if !m.state.AMM.Enabled {
		return fmt.Errorf("amm pool not initialized")
	}
	m.maybeRecoverCircuitBreaker()
	if m.state.AMM.Policy.CircuitBreakerEnabled && m.state.AMM.Guardrails.CircuitBreakerTripped {
		return fmt.Errorf("circuit breaker active: %s", m.state.AMM.Guardrails.CircuitBreakerReason)
	}
	tokenIn, _ := asString(a.Data["tokenIn"])
	trader, _ := asString(a.Data["trader"])
	if trader == "" {
		trader = "anonymous"
	}
	amountIn, ok := asNumber(a.Data["amountIn"])
	if !ok || amountIn <= 0 {
		return fmt.Errorf("invalid swap amount")
	}
	minAmountOut, _ := asNumber(a.Data["minAmountOut"])
	record := ExecutionRecord{
		TS:       time.Now().Unix(),
		Trader:   trader,
		TokenIn:  tokenIn,
		AmountIn: amountIn,
		Status:   "rejected",
	}

	if lim, ok := m.state.AMM.TraderLimits[trader]; ok {
		stats := m.state.AMM.TraderStats[trader]
		if lim.WindowSeconds < 30 {
			lim.WindowSeconds = 30
		}
		nowTs := time.Now().Unix()
		if stats.WindowStartTS == 0 || nowTs-stats.WindowStartTS >= lim.WindowSeconds {
			stats.WindowStartTS = nowTs
			stats.WindowUsedToken0 = 0
		}
		amountToken0Notional := amountIn
		if tokenIn == m.state.AMM.Token1 {
			price := m.state.AMM.LastPriceToken1
			if price <= 0 {
				price = 1
			}
			amountToken0Notional = amountIn / price
		}
		if stats.WindowUsedToken0+amountToken0Notional > lim.MaxNotionalPerWindowToken0 {
			record.Reason = "trader_notional_limit"
			m.state.AMM.RecentExecutions = append(m.state.AMM.RecentExecutions, record)
			return fmt.Errorf("trader notional limit exceeded")
		}
		stats.WindowUsedToken0 += amountToken0Notional
		m.state.AMM.TraderStats[trader] = stats
	}

	feeFactor := (10000 - m.state.AMM.FeeBps) / 10000
	amountInAfterFee := amountIn * feeFactor
	var amountOut float64
	newReserve0 := m.state.AMM.Reserve0
	newReserve1 := m.state.AMM.Reserve1
	newVolume0 := m.state.AMM.VolumeToken0
	newVolume1 := m.state.AMM.VolumeToken1
	tradeTag := ""
	prePrice := m.state.AMM.LastPriceToken1
	if prePrice <= 0 {
		prePrice = m.state.AMM.Reserve1 / m.state.AMM.Reserve0
	}
	if tokenIn == m.state.AMM.Token0 {
		if m.state.AMM.Reserve1 <= 0 {
			return fmt.Errorf("insufficient pool reserves")
		}
		swapRatioBps := (amountIn / m.state.AMM.Reserve0) * 10000
		if swapRatioBps > m.state.AMM.Policy.MaxSwapInRatioBps {
			record.Reason = "swap_ratio_limit"
			m.state.AMM.RecentExecutions = append(m.state.AMM.RecentExecutions, record)
			return fmt.Errorf("swap too large for pool policy")
		}
		amountOut = (m.state.AMM.Reserve1 * amountInAfterFee) / (m.state.AMM.Reserve0 + amountInAfterFee)
		if amountOut <= 0 || amountOut >= m.state.AMM.Reserve1 {
			return fmt.Errorf("invalid output amount")
		}
		if amountOut < minAmountOut {
			return fmt.Errorf("slippage exceeded")
		}
		newReserve0 += amountIn
		newReserve1 -= amountOut
		newVolume0 += amountIn
		newVolume1 += amountOut
		tradeTag = fmt.Sprintf("swap:%s:%s->%s:%.8f", trader, m.state.AMM.Token0, m.state.AMM.Token1, amountOut)
	} else if tokenIn == m.state.AMM.Token1 {
		if m.state.AMM.Reserve0 <= 0 {
			return fmt.Errorf("insufficient pool reserves")
		}
		swapRatioBps := (amountIn / m.state.AMM.Reserve1) * 10000
		if swapRatioBps > m.state.AMM.Policy.MaxSwapInRatioBps {
			record.Reason = "swap_ratio_limit"
			m.state.AMM.RecentExecutions = append(m.state.AMM.RecentExecutions, record)
			return fmt.Errorf("swap too large for pool policy")
		}
		amountOut = (m.state.AMM.Reserve0 * amountInAfterFee) / (m.state.AMM.Reserve1 + amountInAfterFee)
		if amountOut <= 0 || amountOut >= m.state.AMM.Reserve0 {
			return fmt.Errorf("invalid output amount")
		}
		if amountOut < minAmountOut {
			return fmt.Errorf("slippage exceeded")
		}
		newReserve1 += amountIn
		newReserve0 -= amountOut
		newVolume1 += amountIn
		newVolume0 += amountOut
		tradeTag = fmt.Sprintf("swap:%s:%s->%s:%.8f", trader, m.state.AMM.Token1, m.state.AMM.Token0, amountOut)
	} else {
		record.Reason = "invalid_token_in"
		m.state.AMM.RecentExecutions = append(m.state.AMM.RecentExecutions, record)
		return fmt.Errorf("tokenIn must be %s or %s", m.state.AMM.Token0, m.state.AMM.Token1)
	}
	postPrice := newReserve1 / newReserve0
	if prePrice > 0 {
		impactBps := (math.Abs(postPrice-prePrice) / prePrice) * 10000
		if impactBps > m.state.AMM.Policy.MaxPriceImpactBps {
			if m.state.AMM.Policy.CircuitBreakerEnabled {
				m.tripCircuitBreaker("price_impact_limit")
			}
			record.Reason = "price_impact_limit"
			record.PriceImpactBps = impactBps
			m.state.AMM.RecentExecutions = append(m.state.AMM.RecentExecutions, record)
			return fmt.Errorf("price impact exceeded policy")
		}
		m.state.AMM.Guardrails.LastPriceImpactBps = impactBps
		record.PriceImpactBps = impactBps
	}
	now := time.Now().Unix()
	twap := m.computeTWAP(now)
	if twap > 0 {
		deviationBps := (math.Abs(postPrice-twap) / twap) * 10000
		if deviationBps > m.state.AMM.Policy.TwapMaxDeviationBps {
			if m.state.AMM.Policy.CircuitBreakerEnabled {
				m.tripCircuitBreaker("twap_deviation_limit")
			}
			record.Reason = "twap_deviation_limit"
			record.TwapDeviationBps = deviationBps
			m.state.AMM.RecentExecutions = append(m.state.AMM.RecentExecutions, record)
			return fmt.Errorf("twap deviation exceeded policy")
		}
		m.state.AMM.Guardrails.LastDeviationBps = deviationBps
		record.TwapDeviationBps = deviationBps
	}
	m.state.AMM.Guardrails.LastTwapPrice = twap
	m.state.AMM.Reserve0 = newReserve0
	m.state.AMM.Reserve1 = newReserve1
	m.state.AMM.VolumeToken0 = newVolume0
	m.state.AMM.VolumeToken1 = newVolume1
	m.state.AMM.SwapCount++
	if stats, ok := m.state.AMM.TraderStats[trader]; ok {
		stats.TotalSwaps++
		m.state.AMM.TraderStats[trader] = stats
	}
	m.state.Trades = append(m.state.Trades, tradeTag)
	m.touchAMM()
	record.AmountOut = amountOut
	record.Status = "ok"
	m.state.AMM.RecentExecutions = append(m.state.AMM.RecentExecutions, record)
	if len(m.state.AMM.RecentExecutions) > 200 {
		m.state.AMM.RecentExecutions = m.state.AMM.RecentExecutions[len(m.state.AMM.RecentExecutions)-200:]
	}
	return nil
}

func (m *Module) ApplyAction(a models.Action) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	switch a.Type {
	case "amm_swap_exact_in", "amm_set_policy", "amm_set_trader_limit", "amm_reset_circuit_breaker":
		if err := m.validateNonce(a); err != nil {
			return err
		}
	}
	switch a.Type {
	case "amm_init_pool":
		return m.initPool(a)
	case "amm_add_liquidity":
		return m.addLiquidity(a)
	case "amm_remove_liquidity":
		return m.removeLiquidity(a)
	case "amm_swap_exact_in":
		return m.swapExactIn(a)
	case "amm_set_policy":
		return m.setPolicy(a)
	case "amm_set_trader_limit":
		return m.setTraderLimit(a)
	case "amm_reset_circuit_breaker":
		m.resetCircuitBreaker()
		return nil
	default:
		m.applyLegacyOrder(a)
		return nil
	}
}

func (m *Module) GetState() any {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state
}
