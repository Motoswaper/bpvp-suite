package lend
import ("sync";"axe-market-suite/backend/internal/shared/models")
type Position struct{User string `json:"user"`; Collateral float64 `json:"collateral"`; Debt float64 `json:"debt"`; APY float64 `json:"apy"`}
type State struct{Pools map[string]float64 `json:"pools"`; APY map[string]float64 `json:"apy"`; Positions []Position `json:"positions"`}
type Module struct{mu sync.RWMutex; state State}
func New()*Module{return &Module{state:State{Pools:map[string]float64{"main":1000},APY:map[string]float64{"main":4.5},Positions:[]Position{}}}}
func (m *Module)Name()string{return "lend"}
func (m *Module)ApplyEvent(e models.DomainEvent) error { _=e; return nil }
func (m *Module)ApplyAction(a models.Action) error {m.mu.Lock(); defer m.mu.Unlock(); u,_:=a.Data["user"].(string); c,_:=a.Data["collateral"].(float64); d,_:=a.Data["debt"].(float64); m.state.Positions=append(m.state.Positions,Position{User:u,Collateral:c,Debt:d,APY:m.state.APY["main"]}); return nil}
func (m *Module)GetState() any {m.mu.RLock(); defer m.mu.RUnlock(); return m.state}
