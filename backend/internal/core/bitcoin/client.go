package bitcoin

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"axe-market-suite/backend/internal/shared/models"
)

type Client interface {
	LatestHeight() (int64, error)
	BlockHash(height int64) (string, error)
	BlockEvents(height int64) ([]models.DomainEvent, error)
}

type MockClient struct{ seed int64 }

func NewMockClient() *MockClient { return &MockClient{seed: 500000} }

func (c *MockClient) LatestHeight() (int64, error) { return c.seed + (time.Now().Unix() % 200), nil }
func (c *MockClient) BlockHash(height int64) (string, error) {
	return fmt.Sprintf("mock-hash-%d", height), nil
}

func (c *MockClient) BlockEvents(h int64) ([]models.DomainEvent, error) {
	mods := []string{"bpvp20", "bpvp721", "market", "trust", "lend", "settle"}
	m := mods[h%int64(len(mods))]
	return []models.DomainEvent{{
		ID:            fmt.Sprintf("evt-%d", h),
		SchemaVersion: models.CurrentDomainEventSchema,
		Type:          "bitcoin.signal",
		Module:        m,
		Payload:       map[string]any{"amount": float64((h % 9) + 1), "from": "alice", "to": "bob"},
		Height:        h,
		TxID:          fmt.Sprintf("tx-%d", h),
		Timestamp:     time.Now().UTC(),
	}}, nil
}

type RPCClient struct {
	url    string
	user   string
	pass   string
	client *http.Client
}

func NewRPCClient(url, user, pass string) *RPCClient {
	return &RPCClient{url: url, user: user, pass: pass, client: &http.Client{Timeout: 8 * time.Second}}
}

func (c *RPCClient) LatestHeight() (int64, error) {
	var height int64
	if err := c.call("getblockcount", []any{}, &height); err != nil {
		return 0, err
	}
	return height, nil
}

func (c *RPCClient) BlockHash(height int64) (string, error) {
	var hash string
	if err := c.call("getblockhash", []any{height}, &hash); err != nil {
		return "", err
	}
	return hash, nil
}

func (c *RPCClient) BlockEvents(height int64) ([]models.DomainEvent, error) {
	var hash string
	if err := c.call("getblockhash", []any{height}, &hash); err != nil {
		return nil, err
	}

	var block struct {
		Time int64 `json:"time"`
		Tx   []struct {
			TxID string `json:"txid"`
			Vout []struct {
				ScriptPubKey struct {
					ASM string `json:"asm"`
				} `json:"scriptPubKey"`
			} `json:"vout"`
		} `json:"tx"`
	}
	if err := c.call("getblock", []any{hash, 2}, &block); err != nil {
		return nil, err
	}

	blockTS := time.Unix(block.Time, 0).UTC()
	events := []models.DomainEvent{}
	for _, tx := range block.Tx {
		for _, out := range tx.Vout {
			e, matched, err := parseAxeOpReturnEvent(height, tx.TxID, out.ScriptPubKey.ASM, blockTS)
			if err != nil {
				return nil, fmt.Errorf("parse tx %s op_return: %w", tx.TxID, err)
			}
			if matched {
				events = append(events, e)
			}
		}
	}
	return events, nil
}

func (c *RPCClient) call(method string, params []any, out any) error {
	payload := map[string]any{"jsonrpc": "1.0", "id": "axe", "method": method, "params": params}
	raw, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, c.url, bytes.NewBuffer(raw))
	if err != nil {
		return err
	}
	req.SetBasicAuth(c.user, c.pass)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var rpcResp struct {
		Result json.RawMessage `json:"result"`
		Error  any             `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return err
	}
	if rpcResp.Error != nil {
		return fmt.Errorf("rpc %s error: %v", method, rpcResp.Error)
	}
	if err := json.Unmarshal(rpcResp.Result, out); err != nil {
		return err
	}
	return nil
}
