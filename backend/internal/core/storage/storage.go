package storage

import "sync"

type Store interface{Get(string)([]byte,bool); Set(string,[]byte); Delete(string); Snapshot() map[string][]byte}
type MemoryStore struct{mu sync.RWMutex; data map[string][]byte}
func NewMemoryStore()*MemoryStore{return &MemoryStore{data:map[string][]byte{}}}
func (s *MemoryStore)Get(k string)([]byte,bool){s.mu.RLock(); defer s.mu.RUnlock(); v,ok:=s.data[k]; if !ok{return nil,false}; c:=append([]byte(nil),v...); return c,true}
func (s *MemoryStore)Set(k string,v []byte){s.mu.Lock(); defer s.mu.Unlock(); s.data[k]=append([]byte(nil),v...)}
func (s *MemoryStore)Delete(k string){s.mu.Lock(); defer s.mu.Unlock(); delete(s.data,k)}
func (s *MemoryStore)Snapshot() map[string][]byte{s.mu.RLock(); defer s.mu.RUnlock(); out:=map[string][]byte{}; for k,v:=range s.data{out[k]=append([]byte(nil),v...)}; return out}
