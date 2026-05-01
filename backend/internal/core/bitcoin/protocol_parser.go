package bitcoin

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"axe-market-suite/backend/internal/shared/models"
)

const opReturnPrefix = "AXE|"

type protocolEnvelope struct {
	SchemaVersion string         `json:"schemaVersion"`
	Module        string         `json:"module"`
	Type          string         `json:"type"`
	Payload       map[string]any `json:"payload"`
}

func canonicalModuleName(name string) string {
	switch strings.TrimSpace(strings.ToLower(name)) {
	case "axe20", "bpvp20":
		return "bpvp20"
	case "axe721", "bpvp721":
		return "bpvp721"
	default:
		return name
	}
}

func parseAxeOpReturnEvent(height int64, txID string, asm string, ts time.Time) (models.DomainEvent, bool, error) {
	parts := strings.Fields(strings.TrimSpace(asm))
	if len(parts) < 2 || parts[0] != "OP_RETURN" {
		return models.DomainEvent{}, false, nil
	}

	raw, err := hex.DecodeString(parts[1])
	if err != nil {
		return models.DomainEvent{}, false, fmt.Errorf("decode op_return hex: %w", err)
	}

	msg := string(raw)
	if !strings.HasPrefix(msg, opReturnPrefix) {
		return models.DomainEvent{}, false, nil
	}

	var env protocolEnvelope
	if err := json.Unmarshal([]byte(strings.TrimPrefix(msg, opReturnPrefix)), &env); err != nil {
		return models.DomainEvent{}, false, fmt.Errorf("decode protocol envelope: %w", err)
	}
	if env.Module == "" || env.Type == "" {
		return models.DomainEvent{}, false, fmt.Errorf("protocol envelope missing module/type")
	}
	env.Module = canonicalModuleName(env.Module)
	if env.SchemaVersion == "" {
		env.SchemaVersion = models.CurrentDomainEventSchema
	}
	if env.SchemaVersion != models.CurrentDomainEventSchema {
		return models.DomainEvent{}, false, fmt.Errorf("unsupported schemaVersion: %s", env.SchemaVersion)
	}
	if env.Payload == nil {
		env.Payload = map[string]any{}
	}
	if err := validateProtocolEnvelope(env); err != nil {
		return models.DomainEvent{}, false, err
	}

	return models.DomainEvent{
		ID:            fmt.Sprintf("rpc-%s-%s", txID, env.Type),
		SchemaVersion: env.SchemaVersion,
		Type:          env.Type,
		Module:        env.Module,
		Payload:       env.Payload,
		Height:        height,
		TxID:          txID,
		Timestamp:     ts.UTC(),
	}, true, nil
}

func validateProtocolEnvelope(env protocolEnvelope) error {
	validators := map[string]map[string]func(map[string]any) error{
		"bpvp20": {
			"mint":     validateAxe20Mint,
			"transfer": validateAxe20Transfer,
			"burn":     validateAxe20Burn,
		},
		"bpvp721": {
			"bridge_set_policy":        validateBridgeSetPolicy,
			"mint":                     requireStringFields("tokenId"),
			"transfer":                 requireStringFields("tokenId", "to"),
			"metadata_update":          requireStringFields("tokenId", "key", "value"),
			"representation_link":      requireStringFields("tokenId", "network", "standard", "contract", "externalTokenId"),
			"representation_set_state": requireStringFields("tokenId", "network", "standard", "bridgeState"),
			"bridge_enqueue_mint":      requireStringFields("tokenId", "network", "standard", "contract"),
			"bridge_enqueue_burn":      requireStringFields("tokenId", "network", "standard", "contract"),
			"bridge_enqueue_sync":      requireStringFields("tokenId", "network", "standard", "contract"),
			"bridge_approve_job":       requireStringFields("jobId", "approver"),
			"bridge_mark_submitted":    requireStringFields("jobId", "txHash"),
			"bridge_mark_confirmed":    requireStringFields("jobId"),
			"bridge_mark_failed":       requireStringFields("jobId", "error"),
		},
		"market": {
			"order_open":   validateMarketOrderOpen,
			"order_fill":   requirePositiveNumberFields("price", "amount"),
			"order_cancel": requireStringFields("orderId"),
		},
		"lend": {
			"borrow":    validateLendBorrow,
			"repay":     validateLendRepay,
			"liquidate": requireStringFields("user"),
		},
		"trust": {
			"score_update": validateTrustScoreUpdate,
		},
		"settle": {
			"payment_settled":     requireStringFields("id"),
			"liquidation_settled": requireStringFields("id"),
		},
		"otc": {
			"rfq_create":   validateOTCRfqCreate,
			"rfq_cancel":   requireStringFields("rfqId"),
			"quote_submit": validateOTCQuoteSubmit,
			"quote_accept": requireStringFields("rfqId", "quoteId", "taker"),
			"trade_settle": requireStringFields("tradeId", "settleRef"),
		},
	}

	modAllowed, ok := validators[env.Module]
	if !ok {
		return fmt.Errorf("unsupported module: %s", env.Module)
	}
	validate, ok := modAllowed[env.Type]
	if !ok {
		return fmt.Errorf("unsupported type for module %s: %s", env.Module, env.Type)
	}
	if err := validate(env.Payload); err != nil {
		return fmt.Errorf("invalid payload for %s.%s: %w", env.Module, env.Type, err)
	}
	return nil
}

func requireStringFields(keys ...string) func(map[string]any) error {
	return func(payload map[string]any) error {
		for _, k := range keys {
			v, ok := payload[k]
			if !ok {
				return fmt.Errorf("missing required payload key: %s", k)
			}
			s, ok := v.(string)
			if !ok || strings.TrimSpace(s) == "" {
				return fmt.Errorf("payload key %s must be non-empty string", k)
			}
		}
		return nil
	}
}

func requirePositiveNumberFields(keys ...string) func(map[string]any) error {
	return func(payload map[string]any) error {
		for _, k := range keys {
			v, ok := payload[k]
			if !ok {
				return fmt.Errorf("missing required payload key: %s", k)
			}
			n, ok := v.(float64)
			if !ok {
				return fmt.Errorf("payload key %s must be number", k)
			}
			if math.IsNaN(n) || math.IsInf(n, 0) || n <= 0 {
				return fmt.Errorf("payload key %s must be > 0", k)
			}
		}
		return nil
	}
}

func validateAxe20Mint(payload map[string]any) error {
	if err := requirePositiveNumberFields("amount")(payload); err != nil {
		return err
	}
	return requireStringFields("to")(payload)
}

func validateAxe20Transfer(payload map[string]any) error {
	if err := requirePositiveNumberFields("amount")(payload); err != nil {
		return err
	}
	return requireStringFields("from", "to")(payload)
}

func validateAxe20Burn(payload map[string]any) error {
	if err := requirePositiveNumberFields("amount")(payload); err != nil {
		return err
	}
	return requireStringFields("from")(payload)
}

func validateMarketOrderOpen(payload map[string]any) error {
	if err := requirePositiveNumberFields("price", "amount")(payload); err != nil {
		return err
	}
	if err := requireStringFields("side")(payload); err != nil {
		return err
	}
	side := strings.ToLower(strings.TrimSpace(payload["side"].(string)))
	if side != "buy" && side != "sell" {
		return fmt.Errorf("payload key side must be buy or sell")
	}
	return nil
}

func validateLendBorrow(payload map[string]any) error {
	if err := requireStringFields("user")(payload); err != nil {
		return err
	}
	return requirePositiveNumberFields("collateral", "debt")(payload)
}

func validateLendRepay(payload map[string]any) error {
	if err := requireStringFields("user")(payload); err != nil {
		return err
	}
	return requirePositiveNumberFields("debt")(payload)
}

func validateTrustScoreUpdate(payload map[string]any) error {
	if err := requireStringFields("subject", "rating")(payload); err != nil {
		return err
	}
	score, ok := payload["score"].(float64)
	if !ok {
		return fmt.Errorf("payload key score must be number")
	}
	if math.IsNaN(score) || math.IsInf(score, 0) || score < 0 || score > 100 {
		return fmt.Errorf("payload key score must be between 0 and 100")
	}
	return nil
}

func validateOTCRfqCreate(payload map[string]any) error {
	if err := requireStringFields("pair", "side", "requester")(payload); err != nil {
		return err
	}
	if err := requirePositiveNumberFields("quantity")(payload); err != nil {
		return err
	}
	side := strings.ToLower(strings.TrimSpace(payload["side"].(string)))
	if side != "buy" && side != "sell" {
		return fmt.Errorf("payload key side must be buy or sell")
	}
	pair := strings.ToUpper(strings.TrimSpace(payload["pair"].(string)))
	parts := strings.Split(pair, "/")
	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
		return fmt.Errorf("payload key pair must be BASE/QUOTE")
	}
	if limit, ok := payload["limitPrice"]; ok {
		n, ok := limit.(float64)
		if !ok || math.IsNaN(n) || math.IsInf(n, 0) || n <= 0 {
			return fmt.Errorf("payload key limitPrice must be > 0 when provided")
		}
	}
	return nil
}

func validateOTCQuoteSubmit(payload map[string]any) error {
	if err := requireStringFields("rfqId", "maker")(payload); err != nil {
		return err
	}
	return requirePositiveNumberFields("price", "quantity")(payload)
}

func validateBridgeSetPolicy(payload map[string]any) error {
	if allowed, ok := payload["allowedNetworks"]; ok {
		if err := requireNonEmptyStringSlice("allowedNetworks", allowed); err != nil {
			return err
		}
	}
	if allowed, ok := payload["allowedStandards"]; ok {
		if err := requireNonEmptyStringSlice("allowedStandards", allowed); err != nil {
			return err
		}
	}
	if allowed, ok := payload["allowedContracts"]; ok {
		if err := requireNonEmptyStringSlice("allowedContracts", allowed); err != nil {
			return err
		}
	}
	if dual, ok := payload["requireDualApproval"]; ok {
		if _, isBool := dual.(bool); !isBool {
			return fmt.Errorf("payload key requireDualApproval must be boolean")
		}
	}
	return nil
}

func requireNonEmptyStringSlice(key string, value any) error {
	raw, ok := value.([]any)
	if !ok {
		return fmt.Errorf("payload key %s must be array", key)
	}
	for i, item := range raw {
		s, ok := item.(string)
		if !ok || strings.TrimSpace(s) == "" {
			return fmt.Errorf("payload key %s item %d must be non-empty string", key, i)
		}
	}
	return nil
}
