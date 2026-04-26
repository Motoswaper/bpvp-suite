package engine

import (
	"path/filepath"
	"testing"

	"axe-market-suite/backend/internal/modules/axe20"
	"axe-market-suite/backend/internal/modules/axe721"
	"axe-market-suite/backend/internal/modules/lend"
	"axe-market-suite/backend/internal/modules/market"
	"axe-market-suite/backend/internal/modules/settle"
	"axe-market-suite/backend/internal/modules/trust"
	"axe-market-suite/backend/internal/shared/models"
)

func TestEngineReplayDeterministicStateHash(t *testing.T) {
	tmp := t.TempDir()
	journalPath := filepath.Join(tmp, "engine-journal.ndjson")

	// First engine instance applies a deterministic sequence.
	firstRegistry := newRegistryForTest()
	journal, err := NewJournal(journalPath)
	if err != nil {
		t.Fatalf("new journal: %v", err)
	}
	first := New("test", firstRegistry, journal)

	action := models.Action{
		Module: "axe20",
		Type:   "mint",
		Data:   map[string]any{"to": "alice", "amount": 10.0},
	}
	if err := first.ApplyAction(action); err != nil {
		t.Fatalf("apply action: %v", err)
	}

	event := models.DomainEvent{
		ID:      "evt-1",
		Type:    "bitcoin.signal",
		Module:  "trust",
		Payload: map[string]any{"subject": "alice", "score": 98.0, "rating": "A+"},
		Height:  101,
		TxID:    "tx-101",
	}
	if err := first.ApplyEvent(event); err != nil {
		t.Fatalf("apply event: %v", err)
	}

	firstStatus := first.Status()
	firstHash := firstStatus["stateHash"]
	firstHeight := firstStatus["height"]

	// Second instance should deterministically rebuild same state from journal.
	secondRegistry := newRegistryForTest()
	secondJournal, err := NewJournal(journalPath)
	if err != nil {
		t.Fatalf("new journal second: %v", err)
	}
	second := New("test", secondRegistry, secondJournal)
	secondStatus := second.Status()

	if firstHash != secondStatus["stateHash"] {
		t.Fatalf("state hash mismatch: first=%v second=%v", firstHash, secondStatus["stateHash"])
	}
	if firstHeight != secondStatus["height"] {
		t.Fatalf("height mismatch: first=%v second=%v", firstHeight, secondStatus["height"])
	}
}

func newRegistryForTest() *Registry {
	reg := NewRegistry()
	reg.Register(axe20.New())
	reg.Register(axe721.New())
	reg.Register(market.New())
	reg.Register(trust.New())
	reg.Register(lend.New())
	reg.Register(settle.New())
	return reg
}
