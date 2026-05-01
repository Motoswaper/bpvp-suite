package otc

import (
	"testing"

	"axe-market-suite/backend/internal/shared/models"
)

func TestOTCFlow_CreateQuoteAcceptSettle(t *testing.T) {
	m := New()

	err := m.ApplyAction(models.Action{
		Module: "otc",
		Type:   "rfq_create",
		Data: map[string]any{
			"rfqId":     "rfq-1",
			"pair":      "BTC/USD",
			"side":      "buy",
			"quantity":  1.25,
			"requester": "desk-a",
		},
	})
	if err != nil {
		t.Fatalf("rfq_create failed: %v", err)
	}

	err = m.ApplyAction(models.Action{
		Module: "otc",
		Type:   "quote_submit",
		Data: map[string]any{
			"quoteId":  "q-1",
			"rfqId":    "rfq-1",
			"maker":    "maker-a",
			"price":    50000.0,
			"quantity": 1.25,
		},
	})
	if err != nil {
		t.Fatalf("quote_submit failed: %v", err)
	}

	err = m.ApplyAction(models.Action{
		Module: "otc",
		Type:   "quote_accept",
		Data: map[string]any{
			"tradeId": "t-1",
			"rfqId":   "rfq-1",
			"quoteId": "q-1",
			"taker":   "desk-a",
		},
	})
	if err != nil {
		t.Fatalf("quote_accept failed: %v", err)
	}

	err = m.ApplyAction(models.Action{
		Module: "otc",
		Type:   "trade_settle",
		Data: map[string]any{
			"tradeId":   "t-1",
			"settleRef": "txid-123",
		},
	})
	if err != nil {
		t.Fatalf("trade_settle failed: %v", err)
	}

	st := m.GetState().(State)
	if len(st.OpenRFQs) != 0 {
		t.Fatalf("expected no open rfqs, got %d", len(st.OpenRFQs))
	}
	if len(st.OpenTrades) != 0 {
		t.Fatalf("expected no open trades, got %d", len(st.OpenTrades))
	}
	if len(st.Trades) != 1 || st.Trades[0].Status != "settled" {
		t.Fatalf("expected one settled trade, got %+v", st.Trades)
	}
}

func TestOTCRejectsDuplicateIDsAndBadPair(t *testing.T) {
	m := New()

	err := m.ApplyAction(models.Action{
		Module: "otc",
		Type:   "rfq_create",
		Data: map[string]any{
			"rfqId":     "same",
			"pair":      "BTCUSD",
			"side":      "buy",
			"quantity":  1.0,
			"requester": "desk-a",
		},
	})
	if err == nil {
		t.Fatalf("expected invalid pair to fail")
	}

	err = m.ApplyAction(models.Action{
		Module: "otc",
		Type:   "rfq_create",
		Data: map[string]any{
			"rfqId":     "same",
			"pair":      "BTC/USD",
			"side":      "buy",
			"quantity":  1.0,
			"requester": "desk-a",
		},
	})
	if err != nil {
		t.Fatalf("expected first rfq create to pass: %v", err)
	}
	err = m.ApplyAction(models.Action{
		Module: "otc",
		Type:   "rfq_create",
		Data: map[string]any{
			"rfqId":     "same",
			"pair":      "BTC/USD",
			"side":      "sell",
			"quantity":  1.0,
			"requester": "desk-b",
		},
	})
	if err == nil {
		t.Fatalf("expected duplicate rfq id to fail")
	}
}
