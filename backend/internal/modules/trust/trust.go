package trust
import ("sync";"axe-market-suite/backend/internal/shared/models")
type State struct{Scores map[string]float64 `json:"scores"`; Ratings map[string]string `json:"ratings"`; History []string `json:"history"`}
type Module struct{mu sync.RWMutex; state State}
func New()*Module{return &Module{state:State{Scores:map[string]float64{},Ratings:map[string]string{},History:[]string{}}}}
func (m *Module)Name()string{return "trust"}
func (m *Module)ApplyEvent(e models.DomainEvent) error {m.mu.Lock(); defer m.mu.Unlock(); m.state.History=append(m.state.History,e.ID); return nil}
func (m *Module)ApplyAction(a models.Action) error {m.mu.Lock(); defer m.mu.Unlock(); s,_:=a.Data["subject"].(string); sc,_:=a.Data["score"].(float64); r,_:=a.Data["rating"].(string); if s!=""{m.state.Scores[s]=sc; m.state.Ratings[s]=r; m.state.History=append(m.state.History,s+":"+r)}; return nil}
func (m *Module)GetState() any {m.mu.RLock(); defer m.mu.RUnlock(); return m.state}
