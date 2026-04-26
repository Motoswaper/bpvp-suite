package utils

import ("fmt";"sync/atomic";"time")
var seq int64
func NewID(prefix string) string {n:=atomic.AddInt64(&seq,1); return fmt.Sprintf("%s-%d-%d",prefix,time.Now().UnixNano(),n)}
