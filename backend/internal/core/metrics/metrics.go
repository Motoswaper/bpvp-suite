package metrics

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

type Registry struct {
	mu              sync.Mutex
	requestsTotal   map[string]int64
	requestErrors   map[string]int64
	requestDuration map[string]time.Duration
}

func NewRegistry() *Registry {
	return &Registry{
		requestsTotal:   map[string]int64{},
		requestErrors:   map[string]int64{},
		requestDuration: map[string]time.Duration{},
	}
}

func (r *Registry) Observe(path, method string, status int, duration time.Duration) {
	key := metricKey(path, method)
	r.mu.Lock()
	defer r.mu.Unlock()
	r.requestsTotal[key]++
	if status >= 400 {
		r.requestErrors[key]++
	}
	r.requestDuration[key] += duration
}

func (r *Registry) Prometheus() string {
	r.mu.Lock()
	defer r.mu.Unlock()

	keys := make([]string, 0, len(r.requestsTotal))
	for k := range r.requestsTotal {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var b strings.Builder
	b.WriteString("# HELP axe_http_requests_total Total HTTP requests by endpoint.\n")
	b.WriteString("# TYPE axe_http_requests_total counter\n")
	for _, k := range keys {
		path, method := splitKey(k)
		b.WriteString(fmt.Sprintf("axe_http_requests_total{path=%q,method=%q} %d\n", path, method, r.requestsTotal[k]))
	}

	b.WriteString("# HELP axe_http_request_errors_total Total HTTP errors by endpoint.\n")
	b.WriteString("# TYPE axe_http_request_errors_total counter\n")
	for _, k := range keys {
		path, method := splitKey(k)
		b.WriteString(fmt.Sprintf("axe_http_request_errors_total{path=%q,method=%q} %d\n", path, method, r.requestErrors[k]))
	}

	b.WriteString("# HELP axe_http_request_duration_seconds_total Aggregate request duration by endpoint.\n")
	b.WriteString("# TYPE axe_http_request_duration_seconds_total counter\n")
	for _, k := range keys {
		path, method := splitKey(k)
		b.WriteString(fmt.Sprintf("axe_http_request_duration_seconds_total{path=%q,method=%q} %.6f\n", path, method, r.requestDuration[k].Seconds()))
	}

	return b.String()
}

func metricKey(path, method string) string {
	return path + "|" + method
}

func splitKey(k string) (string, string) {
	parts := strings.SplitN(k, "|", 2)
	if len(parts) != 2 {
		return k, "UNKNOWN"
	}
	return parts[0], parts[1]
}
