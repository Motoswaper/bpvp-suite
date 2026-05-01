package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"io"
	"net"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"time"

	"axe-market-suite/backend/internal/core/metrics"
	"github.com/rs/cors"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func Logging(registry *metrics.Registry) func(http.Handler) http.Handler {
	if registry == nil {
		registry = metrics.NewRegistry()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)
			registry.Observe(r.URL.Path, r.Method, rec.status, time.Since(start))
		})
	}
}

func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				_ = rec
				_ = debug.Stack()
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func CORS(next http.Handler) http.Handler {
	return cors.AllowAll().Handler(next)
}

func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := strconv.FormatInt(time.Now().UnixNano(), 16)
		if len(id) < 16 {
			id = hex.EncodeToString([]byte(id))
		}
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r)
	})
}

func APIKey(requiredKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if requiredKey == "" {
				next.ServeHTTP(w, r)
				return
			}
			key := r.Header.Get("X-AXE-API-Key")
			if subtle.ConstantTimeCompare([]byte(requiredKey), []byte(key)) != 1 {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func HMACSignature(secret string, skew time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if secret == "" {
				next.ServeHTTP(w, r)
				return
			}

			tsHeader := r.Header.Get("X-AXE-Timestamp")
			sigHeader := r.Header.Get("X-AXE-Signature")
			if tsHeader == "" || sigHeader == "" {
				http.Error(w, "signature required", http.StatusUnauthorized)
				return
			}
			tsUnix, err := strconv.ParseInt(tsHeader, 10, 64)
			if err != nil {
				http.Error(w, "invalid timestamp", http.StatusUnauthorized)
				return
			}
			now := time.Now().Unix()
			if now-tsUnix > int64(skew.Seconds()) || tsUnix-now > int64(skew.Seconds()) {
				http.Error(w, "stale timestamp", http.StatusUnauthorized)
				return
			}

			body, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, "invalid body", http.StatusBadRequest)
				return
			}
			r.Body = io.NopCloser(bytes.NewBuffer(body))

			payload := r.Method + "|" + r.URL.Path + "|" + tsHeader + "|" + string(body)
			mac := hmac.New(sha256.New, []byte(secret))
			_, _ = mac.Write([]byte(payload))
			expected := hex.EncodeToString(mac.Sum(nil))

			if subtle.ConstantTimeCompare([]byte(expected), []byte(sigHeader)) != 1 {
				http.Error(w, "invalid signature", http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func TrustedCIDRs(cidrs []string) func(http.Handler) http.Handler {
	networks := []*net.IPNet{}
	for _, c := range cidrs {
		_, n, err := net.ParseCIDR(c)
		if err == nil {
			networks = append(networks, n)
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if len(networks) == 0 {
				next.ServeHTTP(w, r)
				return
			}
			ip := clientIP(r.RemoteAddr)
			if ip == nil {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			for _, n := range networks {
				if n.Contains(ip) {
					next.ServeHTTP(w, r)
					return
				}
			}
			http.Error(w, "forbidden", http.StatusForbidden)
		})
	}
}

func RateLimit(perMinute int) func(http.Handler) http.Handler {
	if perMinute <= 0 {
		perMinute = 240
	}
	var mu sync.Mutex
	counts := map[string]int{}
	lastReset := time.Now()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.RemoteAddr
			mu.Lock()
			if time.Since(lastReset) >= time.Minute {
				counts = map[string]int{}
				lastReset = time.Now()
			}
			counts[key]++
			exceeded := counts[key] > perMinute
			mu.Unlock()

			if exceeded {
				http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(remoteAddr string) net.IP {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = strings.TrimSpace(remoteAddr)
	}
	return net.ParseIP(host)
}
