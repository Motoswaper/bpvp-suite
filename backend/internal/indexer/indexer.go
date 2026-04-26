package indexer

import (
    "encoding/json"
	"errors"
    "fmt"
    "os"
    "path/filepath"
    "sort"
    "strconv"
    "sync"
    "time"

    "axe-market-suite/backend/internal/core/bitcoin"
	"axe-market-suite/backend/internal/core/validation"
    "axe-market-suite/backend/internal/shared/models"
)

type Service struct {
    mu            sync.RWMutex
    client        bitcoin.Client
    currentHeight int64
    latestTarget  int64
    checkpointPath string
    deadLetterPath string
    confirmations  int64
	maxRetries     int
	maxDeadLetters int64
    reorgRollbacks int64
    deadLetterCount int64
	permanentFailureCount int64
	transientFailureCount int64
    processed     map[int64]bool
    events        map[int64][]models.DomainEvent
    blockHashes   map[int64]string
    retries       map[int64]int
    bitcoinHealthy bool
    lastBitcoinError string
}

func New(c bitcoin.Client, checkpointPath, deadLetterPath string, confirmations, maxRetries, maxDeadLetters int, startHeight int64) *Service {
    if confirmations < 1 {
        confirmations = 1
    }
	if maxRetries < 1 {
		maxRetries = 1
	}
	if maxDeadLetters < 0 {
		maxDeadLetters = 0
	}
    s := &Service{
        client: c, checkpointPath: checkpointPath,
		deadLetterPath: deadLetterPath, confirmations: int64(confirmations), maxRetries: maxRetries, maxDeadLetters: int64(maxDeadLetters),
        processed: map[int64]bool{}, events: map[int64][]models.DomainEvent{},
        blockHashes: map[int64]string{}, retries: map[int64]int{},
    }
    if startHeight > 0 {
        s.currentHeight = startHeight
    }
    _ = s.loadCheckpoint()
    return s
}

func (s *Service) ProcessNextBlock() error {
    if err := s.ensureCanonicalTip(); err != nil {
        return err
    }

    s.mu.Lock()
    next := s.currentHeight + 1
    s.mu.Unlock()

    latest, err := s.client.LatestHeight()
    if err != nil {
        s.mu.Lock()
        s.bitcoinHealthy = false
        s.lastBitcoinError = err.Error()
        s.mu.Unlock()
        return err
    }
    s.mu.Lock()
    s.latestTarget = latest
    s.bitcoinHealthy = true
    s.lastBitcoinError = ""
    s.mu.Unlock()

    // Process only finalized heights to reduce reorg exposure.
    finalized := latest - s.confirmations
    if finalized < 0 {
        finalized = 0
    }
    if next > finalized {
        return nil
    }
	if err := s.process(next); err != nil {
		class := classifyProcessError(err)
        s.mu.Lock()
        s.retries[next]++
		attempts := s.retries[next]
		if class == errorClassPermanent {
			s.permanentFailureCount++
		} else {
			s.transientFailureCount++
		}
        s.mu.Unlock()

		if class == errorClassPermanent || attempts >= s.maxRetries {
			_ = s.appendDeadLetter(next, err, class, attempts)
			if class == errorClassPermanent {
				// Skip permanently invalid block payloads to prevent indexing lock.
				s.mu.Lock()
				s.currentHeight = next
				s.mu.Unlock()
				_ = s.saveCheckpoint()
				return nil
			}
		}
        return err
    }

    s.mu.Lock()
    s.currentHeight = next
    s.mu.Unlock()
    _ = s.saveCheckpoint()
    return nil
}

func (s *Service) process(h int64) error {
    s.mu.RLock()
    if s.processed[h] {
        s.mu.RUnlock()
        return nil
    }
    s.mu.RUnlock()

    hash, err := s.client.BlockHash(h)
    if err != nil {
        return err
    }
    evts, err := s.client.BlockEvents(h)
    if err != nil {
        return err
    }
	allowed := map[string]struct{}{"axe20": {}, "axe721": {}, "market": {}, "trust": {}, "lend": {}, "settle": {}}
	for i := range evts {
		if evts[i].SchemaVersion == "" {
			evts[i].SchemaVersion = models.CurrentDomainEventSchema
		}
		if _, ok := allowed[evts[i].Module]; !ok {
			return fmt.Errorf("%w: unsupported module %s", ErrPermanent, evts[i].Module)
		}
		if err := validation.ValidateEvent(evts[i]); err != nil {
			return fmt.Errorf("%w: %v", ErrPermanent, err)
		}
	}

    s.mu.Lock()
    s.events[h] = evts
    s.processed[h] = true
    s.blockHashes[h] = hash
    s.mu.Unlock()
    return nil
}

func (s *Service) Run(stop <-chan struct{}) {
    t := time.NewTicker(700 * time.Millisecond)
    defer t.Stop()
    for {
        select {
        case <-stop:
            return
        case <-t.C:
            _ = s.ProcessNextBlock()
        }
    }
}

func (s *Service) Height() int64 { s.mu.RLock(); defer s.mu.RUnlock(); return s.currentHeight }

func (s *Service) Events(from, to int64) ([]models.DomainEvent, error) {
    if from > to {
        return nil, fmt.Errorf("fromHeight must be <= toHeight")
    }
    s.mu.RLock(); defer s.mu.RUnlock()
    keys := []int64{}
    for h := range s.events {
        if h >= from && h <= to { keys = append(keys, h) }
    }
    sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })
    out := []models.DomainEvent{}
    for _, h := range keys { out = append(out, s.events[h]...) }
    return out, nil
}

func (s *Service) Status() map[string]any {
    s.mu.RLock(); defer s.mu.RUnlock()
    retry := 0
    for _, v := range s.retries { retry += v }
    return map[string]any{
        "service": "axe-indexer", "height": s.currentHeight, "targetHeight": s.latestTarget,
        "processedBlocks": len(s.processed), "retryCount": retry, "reorgRollbacks": s.reorgRollbacks,
        "deadLetterCount": s.deadLetterCount, "confirmations": s.confirmations,
		"maxRetries": s.maxRetries, "maxDeadLetters": s.maxDeadLetters,
		"permanentFailureCount": s.permanentFailureCount, "transientFailureCount": s.transientFailureCount,
        "bitcoinHealthy": s.bitcoinHealthy, "lastBitcoinError": s.lastBitcoinError,
		"indexerHealthy": s.bitcoinHealthy && (s.maxDeadLetters == 0 || s.deadLetterCount <= s.maxDeadLetters),
        "idempotent": true, "checkpointPath": s.checkpointPath, "deadLetterPath": s.deadLetterPath,
    }
}

func (s *Service) loadCheckpoint() error {
    if s.checkpointPath == "" { return nil }
    raw, err := os.ReadFile(s.checkpointPath)
    if err != nil { return nil }
    var cp struct{
        Height int64 `json:"height"`
        BlockHashes map[string]string `json:"blockHashes"`
        ReorgRollbacks int64 `json:"reorgRollbacks"`
        DeadLetterCount int64 `json:"deadLetterCount"`
		PermanentFailureCount int64 `json:"permanentFailureCount"`
		TransientFailureCount int64 `json:"transientFailureCount"`
    }
    if err := json.Unmarshal(raw, &cp); err != nil { return err }
    if cp.Height > s.currentHeight { s.currentHeight = cp.Height }
    for k,v := range cp.BlockHashes {
        parsed, err := strconv.ParseInt(k,10,64)
        if err == nil {
            s.blockHashes[parsed] = v
        }
    }
    s.reorgRollbacks = cp.ReorgRollbacks
    s.deadLetterCount = cp.DeadLetterCount
	s.permanentFailureCount = cp.PermanentFailureCount
	s.transientFailureCount = cp.TransientFailureCount
    return nil
}

func (s *Service) saveCheckpoint() error {
    if s.checkpointPath == "" { return nil }
    if err := os.MkdirAll(filepath.Dir(s.checkpointPath), 0o755); err != nil { return err }
    s.mu.RLock()
    h := s.currentHeight
    hashes := map[string]string{}
    for height, hash := range s.blockHashes {
        // keep last 256 hashes for reorg validation after restart
        if height >= h-256 {
            hashes[fmt.Sprintf("%d", height)] = hash
        }
    }
    reorgRollbacks := s.reorgRollbacks
    deadLetterCount := s.deadLetterCount
	permanentFailureCount := s.permanentFailureCount
	transientFailureCount := s.transientFailureCount
    s.mu.RUnlock()
    raw, _ := json.Marshal(map[string]any{
        "height": h, "savedAt": time.Now().UTC(), "blockHashes": hashes,
		"reorgRollbacks": reorgRollbacks, "deadLetterCount": deadLetterCount,
		"permanentFailureCount": permanentFailureCount, "transientFailureCount": transientFailureCount,
    })
    return os.WriteFile(s.checkpointPath, raw, 0o644)
}

func (s *Service) ensureCanonicalTip() error {
    for {
        s.mu.RLock()
        tip := s.currentHeight
        expected, hasExpected := s.blockHashes[tip]
        s.mu.RUnlock()
        if tip == 0 || !hasExpected {
            return nil
        }
        actual, err := s.client.BlockHash(tip)
        if err != nil {
            return err
        }
        if actual == expected {
            return nil
        }
        s.rollbackTo(tip - 1)
        _ = s.saveCheckpoint()
    }
}

func (s *Service) appendDeadLetter(height int64, processErr error, class errorClass, attempts int) error {
    if s.deadLetterPath == "" {
        return nil
    }
    if err := os.MkdirAll(filepath.Dir(s.deadLetterPath), 0o755); err != nil {
        return err
    }
    line, _ := json.Marshal(map[string]any{
        "height": height,
        "error": processErr.Error(),
		"class": string(class),
		"attempts": attempts,
        "timestamp": time.Now().UTC(),
    })
    f, err := os.OpenFile(s.deadLetterPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
    if err != nil {
        return err
    }
    defer f.Close()
    if _, err := f.Write(append(line, '\n')); err != nil {
        return err
    }
    s.mu.Lock()
    s.deadLetterCount++
    s.mu.Unlock()
    return nil
}

type errorClass string

const (
	errorClassTransient errorClass = "transient"
	errorClassPermanent errorClass = "permanent"
)

var ErrPermanent = errors.New("permanent indexer error")

func classifyProcessError(err error) errorClass {
	if errors.Is(err, ErrPermanent) {
		return errorClassPermanent
	}
	return errorClassTransient
}

func (s *Service) rollbackTo(height int64) {
    s.mu.Lock()
    defer s.mu.Unlock()
    for h := range s.processed {
        if h > height {
            delete(s.processed, h)
            delete(s.events, h)
            delete(s.blockHashes, h)
        }
    }
    if s.currentHeight > height {
        s.currentHeight = height
    }
    s.reorgRollbacks++
}
