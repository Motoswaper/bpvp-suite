package otc

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"axe-market-suite/backend/internal/shared/models"
)

type RFQ struct {
	ID         string  `json:"id"`
	Pair       string  `json:"pair"`
	Side       string  `json:"side"`
	Quantity   float64 `json:"quantity"`
	Requester  string  `json:"requester"`
	LimitPrice float64 `json:"limitPrice,omitempty"`
	Status     string  `json:"status"`
	CreatedAt  int64   `json:"createdAt"`
	ExpiresAt  int64   `json:"expiresAt,omitempty"`
	Notes      string  `json:"notes,omitempty"`
}

type Quote struct {
	ID         string  `json:"id"`
	RFQID      string  `json:"rfqId"`
	Maker      string  `json:"maker"`
	Price      float64 `json:"price"`
	Quantity   float64 `json:"quantity"`
	Status     string  `json:"status"`
	CreatedAt  int64   `json:"createdAt"`
	ValidUntil int64   `json:"validUntil,omitempty"`
}

type Trade struct {
	ID        string  `json:"id"`
	RFQID     string  `json:"rfqId"`
	QuoteID   string  `json:"quoteId"`
	Buyer     string  `json:"buyer"`
	Seller    string  `json:"seller"`
	Pair      string  `json:"pair"`
	Price     float64 `json:"price"`
	Quantity  float64 `json:"quantity"`
	Notional  float64 `json:"notional"`
	Status    string  `json:"status"`
	CreatedAt int64   `json:"createdAt"`
	SettledAt int64   `json:"settledAt,omitempty"`
	SettleRef string  `json:"settleRef,omitempty"`
}

type State struct {
	RFQs         []RFQ            `json:"rfqs"`
	Quotes       []Quote          `json:"quotes"`
	Trades       []Trade          `json:"trades"`
	OpenRFQs     map[string]RFQ   `json:"openRfqs"`
	QuotesByRFQ  map[string][]int `json:"quotesByRfq"`
	OpenTrades   map[string]Trade `json:"openTrades"`
	History      []string         `json:"history"`
	NextRFQID    int64            `json:"nextRfqId"`
	NextQuoteID  int64            `json:"nextQuoteId"`
	NextTradeID  int64            `json:"nextTradeId"`
	LastSyncUnix int64            `json:"lastSyncUnix"`
}

type Module struct {
	mu    sync.RWMutex
	state State
}

const maxHistoryEntries = 500

func New() *Module {
	return &Module{
		state: State{
			RFQs:         []RFQ{},
			Quotes:       []Quote{},
			Trades:       []Trade{},
			OpenRFQs:     map[string]RFQ{},
			QuotesByRFQ:  map[string][]int{},
			OpenTrades:   map[string]Trade{},
			History:      []string{},
			NextRFQID:    1,
			NextQuoteID:  1,
			NextTradeID:  1,
			LastSyncUnix: time.Now().Unix(),
		},
	}
}

func (m *Module) Name() string { return "otc" }

func (m *Module) ApplyEvent(e models.DomainEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pushHistory("event:" + e.ID)
	m.touch()
	return nil
}

func (m *Module) ApplyAction(a models.Action) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	switch a.Type {
	case "rfq_create":
		return m.createRFQ(a)
	case "rfq_cancel":
		return m.cancelRFQ(a)
	case "quote_submit":
		return m.submitQuote(a)
	case "quote_accept":
		return m.acceptQuote(a)
	case "trade_settle":
		return m.settleTrade(a)
	default:
		return fmt.Errorf("unsupported otc action: %s", a.Type)
	}
}

func (m *Module) GetState() any {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state
}

func (m *Module) createRFQ(a models.Action) error {
	id := strings.TrimSpace(asString(a.Data["rfqId"]))
	if id == "" {
		id = fmt.Sprintf("rfq-%06d", m.state.NextRFQID)
		m.state.NextRFQID++
	}
	if _, exists := m.state.OpenRFQs[id]; exists {
		return fmt.Errorf("rfq already exists: %s", id)
	}
	if m.rfqExists(id) {
		return fmt.Errorf("rfq id already used: %s", id)
	}
	side := strings.ToLower(strings.TrimSpace(asString(a.Data["side"])))
	if side != "buy" && side != "sell" {
		return fmt.Errorf("side must be buy or sell")
	}
	pair := strings.ToUpper(strings.TrimSpace(asString(a.Data["pair"])))
	if !isValidPair(pair) {
		return fmt.Errorf("pair must be BASE/QUOTE (e.g. BTC/USD)")
	}
	requester := strings.TrimSpace(asString(a.Data["requester"]))
	if requester == "" {
		return fmt.Errorf("requester is required")
	}
	quantity := asNumber(a.Data["quantity"])
	if quantity <= 0 {
		return fmt.Errorf("quantity must be > 0")
	}
	limitPrice := asNumber(a.Data["limitPrice"])
	expiresAt := int64(asNumber(a.Data["expiresAt"]))
	now := time.Now().Unix()
	if expiresAt > 0 && expiresAt <= now {
		return fmt.Errorf("expiresAt must be in the future")
	}

	rfq := RFQ{
		ID:         id,
		Pair:       pair,
		Side:       side,
		Quantity:   quantity,
		Requester:  requester,
		LimitPrice: limitPrice,
		Status:     "open",
		CreatedAt:  now,
		ExpiresAt:  expiresAt,
		Notes:      strings.TrimSpace(asString(a.Data["notes"])),
	}

	m.state.RFQs = append(m.state.RFQs, rfq)
	m.state.OpenRFQs[id] = rfq
	m.pushHistory("rfq_create:" + id)
	m.touch()
	return nil
}

func (m *Module) cancelRFQ(a models.Action) error {
	rfqID := strings.TrimSpace(asString(a.Data["rfqId"]))
	if rfqID == "" {
		return fmt.Errorf("rfqId is required")
	}
	rfq, ok := m.state.OpenRFQs[rfqID]
	if !ok {
		return fmt.Errorf("rfq not open: %s", rfqID)
	}
	if rfq.Status != "open" {
		return fmt.Errorf("rfq not cancellable in status: %s", rfq.Status)
	}
	reason := strings.TrimSpace(asString(a.Data["reason"]))
	if reason == "" {
		reason = "manual_cancel"
	}
	rfq.Status = "cancelled"
	delete(m.state.OpenRFQs, rfqID)
	m.syncRFQ(rfq)
	m.pushHistory("rfq_cancel:" + rfqID + ":" + reason)
	m.touch()
	return nil
}

func (m *Module) submitQuote(a models.Action) error {
	rfqID := strings.TrimSpace(asString(a.Data["rfqId"]))
	if rfqID == "" {
		return fmt.Errorf("rfqId is required")
	}
	rfq, ok := m.state.OpenRFQs[rfqID]
	if !ok || rfq.Status != "open" {
		return fmt.Errorf("rfq not open: %s", rfqID)
	}
	now := time.Now().Unix()
	if rfq.ExpiresAt > 0 && now > rfq.ExpiresAt {
		rfq.Status = "expired"
		m.state.OpenRFQs[rfqID] = rfq
		m.syncRFQ(rfq)
		return fmt.Errorf("rfq expired: %s", rfqID)
	}

	maker := strings.TrimSpace(asString(a.Data["maker"]))
	if maker == "" {
		return fmt.Errorf("maker is required")
	}
	price := asNumber(a.Data["price"])
	quantity := asNumber(a.Data["quantity"])
	if price <= 0 || quantity <= 0 {
		return fmt.Errorf("price and quantity must be > 0")
	}
	if quantity > rfq.Quantity {
		return fmt.Errorf("quote quantity exceeds rfq quantity")
	}
	validUntil := int64(asNumber(a.Data["validUntil"]))
	if validUntil > 0 && validUntil <= now {
		return fmt.Errorf("validUntil must be in the future")
	}

	id := strings.TrimSpace(asString(a.Data["quoteId"]))
	if id == "" {
		id = fmt.Sprintf("quote-%06d", m.state.NextQuoteID)
		m.state.NextQuoteID++
	}
	if m.quoteExists(id) {
		return fmt.Errorf("quote id already used: %s", id)
	}
	quote := Quote{
		ID:         id,
		RFQID:      rfqID,
		Maker:      maker,
		Price:      price,
		Quantity:   quantity,
		Status:     "open",
		CreatedAt:  now,
		ValidUntil: validUntil,
	}
	m.state.Quotes = append(m.state.Quotes, quote)
	m.state.QuotesByRFQ[rfqID] = append(m.state.QuotesByRFQ[rfqID], len(m.state.Quotes)-1)
	m.pushHistory("quote_submit:" + id + ":" + rfqID)
	m.touch()
	return nil
}

func (m *Module) acceptQuote(a models.Action) error {
	rfqID := strings.TrimSpace(asString(a.Data["rfqId"]))
	quoteID := strings.TrimSpace(asString(a.Data["quoteId"]))
	taker := strings.TrimSpace(asString(a.Data["taker"]))
	if rfqID == "" || quoteID == "" || taker == "" {
		return fmt.Errorf("rfqId, quoteId and taker are required")
	}
	rfq, ok := m.state.OpenRFQs[rfqID]
	if !ok || rfq.Status != "open" {
		return fmt.Errorf("rfq not open: %s", rfqID)
	}

	idx, quote, ok := m.findQuote(rfqID, quoteID)
	if !ok {
		return fmt.Errorf("quote not found for rfq: %s/%s", rfqID, quoteID)
	}
	now := time.Now().Unix()
	if quote.ValidUntil > 0 && now > quote.ValidUntil {
		return fmt.Errorf("quote expired: %s", quoteID)
	}
	if quote.Status != "open" {
		return fmt.Errorf("quote not open: %s", quoteID)
	}

	quote.Status = "accepted"
	m.state.Quotes[idx] = quote
	for _, qIdx := range m.state.QuotesByRFQ[rfqID] {
		if qIdx != idx && m.state.Quotes[qIdx].Status == "open" {
			m.state.Quotes[qIdx].Status = "rejected"
		}
	}

	rfq.Status = "matched"
	m.state.OpenRFQs[rfqID] = rfq
	m.syncRFQ(rfq)

	tradeID := strings.TrimSpace(asString(a.Data["tradeId"]))
	if tradeID == "" {
		tradeID = fmt.Sprintf("trade-%06d", m.state.NextTradeID)
		m.state.NextTradeID++
	}
	if m.tradeExists(tradeID) {
		return fmt.Errorf("trade id already used: %s", tradeID)
	}

	buyer := taker
	seller := quote.Maker
	if rfq.Side == "sell" {
		buyer = quote.Maker
		seller = taker
	}
	trade := Trade{
		ID:        tradeID,
		RFQID:     rfqID,
		QuoteID:   quoteID,
		Buyer:     buyer,
		Seller:    seller,
		Pair:      rfq.Pair,
		Price:     quote.Price,
		Quantity:  quote.Quantity,
		Notional:  quote.Price * quote.Quantity,
		Status:    "matched",
		CreatedAt: now,
	}
	m.state.Trades = append(m.state.Trades, trade)
	m.state.OpenTrades[trade.ID] = trade
	delete(m.state.OpenRFQs, rfqID)
	m.pushHistory("quote_accept:" + quoteID + ":" + tradeID)
	m.touch()
	return nil
}

func (m *Module) settleTrade(a models.Action) error {
	tradeID := strings.TrimSpace(asString(a.Data["tradeId"]))
	if tradeID == "" {
		return fmt.Errorf("tradeId is required")
	}
	trade, ok := m.state.OpenTrades[tradeID]
	if !ok {
		return fmt.Errorf("open trade not found: %s", tradeID)
	}
	if trade.Status != "matched" {
		return fmt.Errorf("trade not in matched status: %s", trade.Status)
	}
	ref := strings.TrimSpace(asString(a.Data["settleRef"]))
	if ref == "" {
		return fmt.Errorf("settleRef is required")
	}
	now := time.Now().Unix()
	trade.Status = "settled"
	trade.SettledAt = now
	trade.SettleRef = ref
	delete(m.state.OpenTrades, tradeID)
	m.syncTrade(trade)
	m.pushHistory("trade_settle:" + tradeID)
	m.touch()
	return nil
}

func (m *Module) touch() {
	m.state.LastSyncUnix = time.Now().Unix()
}

func (m *Module) pushHistory(entry string) {
	m.state.History = append(m.state.History, entry)
	if len(m.state.History) > maxHistoryEntries {
		m.state.History = m.state.History[len(m.state.History)-maxHistoryEntries:]
	}
}

func (m *Module) syncRFQ(next RFQ) {
	for i := range m.state.RFQs {
		if m.state.RFQs[i].ID == next.ID {
			m.state.RFQs[i] = next
			return
		}
	}
}

func (m *Module) syncTrade(next Trade) {
	for i := range m.state.Trades {
		if m.state.Trades[i].ID == next.ID {
			m.state.Trades[i] = next
			return
		}
	}
}

func (m *Module) findQuote(rfqID, quoteID string) (int, Quote, bool) {
	for _, idx := range m.state.QuotesByRFQ[rfqID] {
		if idx >= 0 && idx < len(m.state.Quotes) && m.state.Quotes[idx].ID == quoteID {
			return idx, m.state.Quotes[idx], true
		}
	}
	return -1, Quote{}, false
}

func (m *Module) rfqExists(rfqID string) bool {
	for i := range m.state.RFQs {
		if m.state.RFQs[i].ID == rfqID {
			return true
		}
	}
	return false
}

func (m *Module) quoteExists(quoteID string) bool {
	for i := range m.state.Quotes {
		if m.state.Quotes[i].ID == quoteID {
			return true
		}
	}
	return false
}

func (m *Module) tradeExists(tradeID string) bool {
	for i := range m.state.Trades {
		if m.state.Trades[i].ID == tradeID {
			return true
		}
	}
	return false
}

func isValidPair(pair string) bool {
	if pair == "" {
		return false
	}
	parts := strings.Split(pair, "/")
	if len(parts) != 2 {
		return false
	}
	base := strings.TrimSpace(parts[0])
	quote := strings.TrimSpace(parts[1])
	return base != "" && quote != "" && base != quote
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}

func asNumber(v any) float64 {
	n, _ := v.(float64)
	return n
}
