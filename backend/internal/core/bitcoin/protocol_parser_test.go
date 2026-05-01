package bitcoin

import (
	"encoding/hex"
	"encoding/json"
	"testing"
	"time"
)

func TestParseAxeOpReturnEvent(t *testing.T) {
	ts := time.Unix(1710000000, 0).UTC()
	asm := mustAsmEnvelope(t, map[string]any{
		"schemaVersion": "1.0",
		"module":        "axe20",
		"type":          "mint",
		"payload": map[string]any{
			"amount": 10.0,
			"to":     "alice",
		},
	})

	evt, matched, err := parseAxeOpReturnEvent(123, "tx-1", asm, ts)
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if !matched {
		t.Fatalf("expected op_return payload to match AXE envelope")
	}
	if evt.Module != "bpvp20" || evt.Type != "mint" {
		t.Fatalf("unexpected event module/type: %s/%s", evt.Module, evt.Type)
	}
	if evt.Height != 123 || evt.TxID != "tx-1" {
		t.Fatalf("unexpected event routing fields: height=%d tx=%s", evt.Height, evt.TxID)
	}
}

func TestParseAxeOpReturnEvent_AxeAliasNormalizesToBpvp(t *testing.T) {
	ts := time.Now().UTC()
	asm := mustAsmEnvelope(t, map[string]any{
		"schemaVersion": "1.0",
		"module":        "axe20",
		"type":          "transfer",
		"payload": map[string]any{
			"amount": 1.0,
			"from":   "alice",
			"to":     "bob",
		},
	})

	evt, matched, err := parseAxeOpReturnEvent(99, "tx-alias", asm, ts)
	if err != nil || !matched {
		t.Fatalf("expected alias payload to parse, err=%v matched=%v", err, matched)
	}
	if evt.Module != "bpvp20" {
		t.Fatalf("expected canonical module bpvp20, got %s", evt.Module)
	}
}

func TestParseAxeOpReturnEvent_IgnoresNonAxePayload(t *testing.T) {
	ts := time.Now().UTC()
	asm := "OP_RETURN 68656c6c6f"

	_, matched, err := parseAxeOpReturnEvent(1, "tx-2", asm, ts)
	if err != nil {
		t.Fatalf("non-AXE payload should not error: %v", err)
	}
	if matched {
		t.Fatalf("expected non-AXE payload to be ignored")
	}
}

func TestParseAxeOpReturnEvent_InvalidEnvelopeFails(t *testing.T) {
	ts := time.Now().UTC()
	asm := mustAsmEnvelope(t, map[string]any{
		"schemaVersion": "1.0",
		"module":        "axe20",
		"type":          "mint",
		"payload": map[string]any{
			"to": "alice",
		},
	})

	_, matched, err := parseAxeOpReturnEvent(1, "tx-3", asm, ts)
	if err == nil {
		t.Fatalf("expected invalid envelope to fail")
	}
	if matched {
		t.Fatalf("invalid envelope should not produce event")
	}
}

func TestParseAxeOpReturnEvent_UnsupportedSchemaFails(t *testing.T) {
	ts := time.Now().UTC()
	asm := mustAsmEnvelope(t, map[string]any{
		"schemaVersion": "2.0",
		"module":        "axe20",
		"type":          "mint",
		"payload": map[string]any{
			"amount": 1.0,
			"to":     "alice",
		},
	})

	_, matched, err := parseAxeOpReturnEvent(1, "tx-4", asm, ts)
	if err == nil {
		t.Fatalf("expected unsupported schemaVersion to fail")
	}
	if matched {
		t.Fatalf("unsupported schema payload should not produce event")
	}
}

func TestParseAxeOpReturnEvent_InvalidTypesFail(t *testing.T) {
	ts := time.Now().UTC()
	asm := mustAsmEnvelope(t, map[string]any{
		"schemaVersion": "1.0",
		"module":        "market",
		"type":          "order_open",
		"payload": map[string]any{
			"side":   "up",
			"price":  -1.0,
			"amount": 0.0,
		},
	})

	_, matched, err := parseAxeOpReturnEvent(1, "tx-5", asm, ts)
	if err == nil {
		t.Fatalf("expected invalid payload types/values to fail")
	}
	if matched {
		t.Fatalf("invalid payload should not produce event")
	}
}

func TestParseAxeOpReturnEvent_OTCAccepted(t *testing.T) {
	ts := time.Now().UTC()
	asm := mustAsmEnvelope(t, map[string]any{
		"schemaVersion": "1.0",
		"module":        "otc",
		"type":          "rfq_create",
		"payload": map[string]any{
			"pair":      "BTC/USD",
			"side":      "buy",
			"quantity":  2.0,
			"requester": "desk-alpha",
		},
	})

	evt, matched, err := parseAxeOpReturnEvent(5, "tx-otc-1", asm, ts)
	if err != nil || !matched {
		t.Fatalf("expected otc payload to parse, err=%v matched=%v", err, matched)
	}
	if evt.Module != "otc" || evt.Type != "rfq_create" {
		t.Fatalf("unexpected otc event module/type: %s/%s", evt.Module, evt.Type)
	}
}

func TestParseAxeOpReturnEvent_BridgePolicyAccepted(t *testing.T) {
	ts := time.Now().UTC()
	asm := mustAsmEnvelope(t, map[string]any{
		"schemaVersion": "1.0",
		"module":        "bpvp721",
		"type":          "bridge_set_policy",
		"payload": map[string]any{
			"requireDualApproval": true,
			"allowedNetworks":     []string{"bitcoin", "rootstock"},
			"allowedStandards":    []string{"ordinals", "erc721"},
		},
	})

	evt, matched, err := parseAxeOpReturnEvent(5, "tx-bridge-1", asm, ts)
	if err != nil || !matched {
		t.Fatalf("expected bridge policy payload to parse, err=%v matched=%v", err, matched)
	}
	if evt.Module != "bpvp721" || evt.Type != "bridge_set_policy" {
		t.Fatalf("unexpected bridge event module/type: %s/%s", evt.Module, evt.Type)
	}
}

func TestParseAxeOpReturnEvent_BridgePolicyInvalidBoolFails(t *testing.T) {
	ts := time.Now().UTC()
	asm := mustAsmEnvelope(t, map[string]any{
		"schemaVersion": "1.0",
		"module":        "bpvp721",
		"type":          "bridge_set_policy",
		"payload": map[string]any{
			"requireDualApproval": "yes",
		},
	})

	_, matched, err := parseAxeOpReturnEvent(5, "tx-bridge-2", asm, ts)
	if err == nil {
		t.Fatalf("expected invalid bridge_set_policy payload to fail")
	}
	if matched {
		t.Fatalf("invalid bridge policy payload should not produce event")
	}
}

func mustAsmEnvelope(t *testing.T, env map[string]any) string {
	t.Helper()
	raw, err := json.Marshal(env)
	if err != nil {
		t.Fatalf("marshal env: %v", err)
	}
	msg := []byte(opReturnPrefix + string(raw))
	return "OP_RETURN " + hex.EncodeToString(msg)
}
