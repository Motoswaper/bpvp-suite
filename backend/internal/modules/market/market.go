package market
import ("sync";"axe-market-suite/backend/internal/shared/models")
type Order struct{ID string `json:"id"`; Side string `json:"side"`; Price float64 `json:"price"`; Amount float64 `json:"amount"`}
type State struct{Bids []Order `json:"bids"`; Asks []Order `json:"asks"`; Trades []string `json:"trades"`}
type Module struct{mu sync.RWMutex; state State}
func New()*Module{return &Module{state:State{Bids:[]Order{},Asks:[]Order{},Trades:[]string{}}}}
func (m *Module)Name()string{return "market"}
func (m *Module)ApplyEvent(e models.DomainEvent) error {m.mu.Lock(); defer m.mu.Unlock(); m.state.Trades=append(m.state.Trades,e.TxID); return nil}
func (m *Module)ApplyAction(a models.Action) error {m.mu.Lock(); defer m.mu.Unlock(); o:=Order{ID:a.Type,Side:"buy",Price:1,Amount:1}; if s,ok:=a.Data["side"].(string);ok{o.Side=s}; if p,ok:=a.Data["price"].(float64);ok{o.Price=p}; if q,ok:=a.Data["amount"].(float64);ok{o.Amount=q}; if o.Side=="buy"{m.state.Bids=append(m.state.Bids,o)}else{m.state.Asks=append(m.state.Asks,o)}; return nil}
func (m *Module)GetState() any {m.mu.RLock(); defer m.mu.RUnlock(); return m.state}
