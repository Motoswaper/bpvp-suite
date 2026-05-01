package watcher

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"go.uber.org/zap"
)

type Service struct {
	mu                sync.RWMutex
	logger            *zap.Logger
	indexerURL        string
	engineURL         string
	apiKey            string
	hmacSecret        string
	interval          time.Duration
	maxSyncLagSeconds int64
	lastSynced        int64
	pushedCount       int64
	lastSuccessUnix   int64
	client            *http.Client
}

func New(logger *zap.Logger, indexerURL, engineURL string, intervalSeconds int, maxSyncLagSeconds int, apiKey, hmacSecret string) *Service {
	if maxSyncLagSeconds < 1 {
		maxSyncLagSeconds = 300
	}
	return &Service{
		logger:            logger,
		indexerURL:        indexerURL,
		engineURL:         engineURL,
		apiKey:            apiKey,
		hmacSecret:        hmacSecret,
		interval:          time.Duration(intervalSeconds) * time.Second,
		maxSyncLagSeconds: int64(maxSyncLagSeconds),
		client:            &http.Client{Timeout: 4 * time.Second},
	}
}

func (s *Service) Run(stop <-chan struct{}) {
	t := time.NewTicker(s.interval)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
			s.syncOnce()
		}
	}
}

func (s *Service) syncOnce() {
	s.mu.RLock()
	from := s.lastSynced + 1
	s.mu.RUnlock()
	to := from + 12
	req := fmt.Sprintf("%s/events?fromHeight=%d&toHeight=%d", s.indexerURL, from, to)
	resp, err := s.client.Get(req)
	if err != nil {
		s.logger.Warn("indexer pull failed", zap.Error(err))
		return
	}
	defer resp.Body.Close()

	var payload struct {
		Events []map[string]any `json:"events"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		s.logger.Warn("decode failed", zap.Error(err))
		return
	}

	var pushed int
	for _, evt := range payload.Events {
		action := map[string]any{"module": evt["module"], "type": "sync", "data": evt["payload"]}
		b, _ := json.Marshal(action)
		r, err := http.NewRequest(http.MethodPost, s.engineURL+"/actions", bytes.NewBuffer(b))
		if err == nil {
			r.Header.Set("Content-Type", "application/json")
			if s.apiKey != "" {
				r.Header.Set("X-AXE-API-Key", s.apiKey)
			}
			if s.hmacSecret != "" {
				ts := fmt.Sprintf("%d", time.Now().Unix())
				r.Header.Set("X-AXE-Timestamp", ts)
				payloadToSign := r.Method + "|" + r.URL.Path + "|" + ts + "|" + string(b)
				mac := hmac.New(sha256.New, []byte(s.hmacSecret))
				_, _ = mac.Write([]byte(payloadToSign))
				r.Header.Set("X-AXE-Signature", hex.EncodeToString(mac.Sum(nil)))
			}
			respPush, err := s.client.Do(r)
			if err == nil && respPush != nil {
				_ = respPush.Body.Close()
				if respPush.StatusCode < 400 {
					pushed++
				}
			}
		}
		if h, ok := evt["height"].(float64); ok {
			s.mu.Lock()
			if int64(h) > s.lastSynced {
				s.lastSynced = int64(h)
			}
			s.mu.Unlock()
		}
	}

	s.mu.Lock()
	s.pushedCount += int64(pushed)
	last := s.lastSynced
	s.lastSuccessUnix = time.Now().Unix()
	s.mu.Unlock()
	s.logger.Info("sync cycle", zap.Int("pushed", pushed), zap.Int64("lastSynced", last))
}

func (s *Service) Status() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return map[string]any{
		"service":           "axe-watcher",
		"lastSyncedHeight":  s.lastSynced,
		"actionsPushed":     s.pushedCount,
		"lastSuccessUnix":   s.lastSuccessUnix,
		"maxSyncLagSeconds": s.maxSyncLagSeconds,
		"syncLagHealthy":    s.syncLagHealthyLocked(),
		"indexerURL":        s.indexerURL,
		"engineURL":         s.engineURL,
	}
}

func (s *Service) syncLagHealthyLocked() bool {
	if s.lastSuccessUnix == 0 {
		return false
	}
	return time.Now().Unix()-s.lastSuccessUnix <= s.maxSyncLagSeconds
}
