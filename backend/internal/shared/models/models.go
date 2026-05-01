package models

import "time"

const CurrentDomainEventSchema = "1.0"

type DomainEvent struct {
	ID            string         `json:"id"`
	SchemaVersion string         `json:"schemaVersion"`
	Type          string         `json:"type"`
	Module        string         `json:"module"`
	Payload       map[string]any `json:"payload"`
	Height        int64          `json:"height"`
	TxID          string         `json:"txId"`
	Timestamp     time.Time      `json:"timestamp"`
}

type Action struct {
	Module string         `json:"module"`
	Type   string         `json:"type"`
	Data   map[string]any `json:"data"`
}
