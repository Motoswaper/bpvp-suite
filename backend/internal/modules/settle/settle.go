package settle
import ("sync";"axe-market-suite/backend/internal/shared/models")
type Settlement struct{ID string `json:"id"`; Status string `json:"status"`}
type State struct{Liquidations []string `json:"liquidations"`; Payments []string `json:"payments"`; Records []Settlement `json:"records"`}
type Module struct{mu sync.RWMutex; state State}
func New()*Module{return &Module{state:State{Liquidations:[]string{},Payments:[]string{},Records:[]Settlement{}}}}
func (m *Module)Name()string{return "settle"}
func (m *Module)ApplyEvent(e models.DomainEvent) error {m.mu.Lock(); defer m.mu.Unlock(); m.state.Payments=append(m.state.Payments,e.TxID); return nil}
func (m *Module)ApplyAction(a models.Action) error {m.mu.Lock(); defer m.mu.Unlock(); id,_:=a.Data["id"].(string); if id==""{id=a.Type}; m.state.Records=append(m.state.Records,Settlement{ID:id,Status:"settled"}); return nil}
func (m *Module)GetState() any {m.mu.RLock(); defer m.mu.RUnlock(); return m.state}
