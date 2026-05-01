package engine

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"axe-market-suite/backend/internal/shared/models"
)

const (
	JournalTypeAction = "action"
	JournalTypeEvent  = "event"
)

type JournalEntry struct {
	EntryHash string              `json:"entryHash,omitempty"`
	PrevHash  string              `json:"prevHash,omitempty"`
	Type      string              `json:"type"`
	Action    *models.Action      `json:"action,omitempty"`
	Event     *models.DomainEvent `json:"event,omitempty"`
	Timestamp time.Time           `json:"timestamp"`
}

type Journal struct {
	mu   sync.Mutex
	path string
}

func NewJournal(path string) (*Journal, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	return &Journal{path: path}, nil
}

func (j *Journal) Append(entry JournalEntry) error {
	j.mu.Lock()
	defer j.mu.Unlock()

	entry.Timestamp = time.Now().UTC()
	prev, _ := j.lastEntryHashLocked()
	entry.PrevHash = prev
	entry.EntryHash = computeEntryHash(entry)
	file, err := os.OpenFile(j.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer file.Close()

	raw, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	if _, err := file.Write(append(raw, '\n')); err != nil {
		return err
	}
	return file.Sync()
}

func (j *Journal) ReadAll() ([]JournalEntry, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.readAllLocked()
}

func (j *Journal) readAllLocked() ([]JournalEntry, error) {
	file, err := os.OpenFile(j.path, os.O_CREATE|os.O_RDONLY, 0o644)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	out := []JournalEntry{}
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var entry JournalEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			return nil, err
		}
		out = append(out, entry)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (j *Journal) VerifyIntegrity() error {
	entries, err := j.ReadAll()
	if err != nil {
		return err
	}
	prev := ""
	for i, entry := range entries {
		if entry.PrevHash != prev {
			return fmt.Errorf("journal chain broken at index %d: prev hash mismatch", i)
		}
		expected := computeEntryHash(JournalEntry{
			PrevHash: entry.PrevHash, Type: entry.Type, Action: entry.Action, Event: entry.Event, Timestamp: entry.Timestamp,
		})
		if entry.EntryHash == "" || entry.EntryHash != expected {
			return fmt.Errorf("journal chain broken at index %d: entry hash mismatch", i)
		}
		prev = entry.EntryHash
	}
	return nil
}

func (j *Journal) Path() string {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.path
}

func (j *Journal) Ready() error {
	j.mu.Lock()
	defer j.mu.Unlock()
	file, err := os.OpenFile(j.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	return file.Close()
}

func (j *Journal) lastEntryHash() (string, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.lastEntryHashLocked()
}

func (j *Journal) lastEntryHashLocked() (string, error) {
	entries, err := j.readAllLocked()
	if err != nil {
		return "", err
	}
	if len(entries) == 0 {
		return "", nil
	}
	return entries[len(entries)-1].EntryHash, nil
}

func computeEntryHash(entry JournalEntry) string {
	payload := map[string]any{
		"prevHash":  entry.PrevHash,
		"type":      entry.Type,
		"action":    entry.Action,
		"event":     entry.Event,
		"timestamp": entry.Timestamp,
	}
	raw, _ := json.Marshal(payload)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
