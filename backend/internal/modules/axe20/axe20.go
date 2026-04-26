package axe20
import ("sync";"axe-market-suite/backend/internal/shared/models")
type State struct { Balances map[string]float64 `json:"balances"`; Supply float64 `json:"supply"`; Metadata map[string]string `json:"metadata"` }
type Module struct{mu sync.RWMutex; state State}
func New()*Module{return &Module{state:State{Balances:map[string]float64{},Metadata:map[string]string{"symbol":"AXE20","name":"AXE Fungible"}}}}
func (m *Module)Name()string{return "axe20"}
func (m *Module)ApplyEvent(e models.DomainEvent) error {m.mu.Lock(); defer m.mu.Unlock(); amt,_:=e.Payload["amount"].(float64); to,_:=e.Payload["to"].(string); if amt==0{amt=1}; if to==""{to="engine"}; m.state.Balances[to]+=amt; m.state.Supply+=amt; return nil}
func (m *Module)ApplyAction(a models.Action) error {m.mu.Lock(); defer m.mu.Unlock(); from,_:=a.Data["from"].(string); to,_:=a.Data["to"].(string); amt,_:=a.Data["amount"].(float64); if amt==0{amt=1}; switch a.Type{case "mint": m.state.Balances[to]+=amt; m.state.Supply+=amt; case "burn": if m.state.Balances[from]>=amt{m.state.Balances[from]-=amt; m.state.Supply-=amt}; case "transfer": if m.state.Balances[from]>=amt{m.state.Balances[from]-=amt; m.state.Balances[to]+=amt}}; return nil}
func (m *Module)GetState() any {m.mu.RLock(); defer m.mu.RUnlock(); return m.state}
