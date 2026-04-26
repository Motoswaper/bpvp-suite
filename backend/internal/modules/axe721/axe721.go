package axe721
import ("sync";"axe-market-suite/backend/internal/shared/models")
type NFT struct{TokenID string `json:"tokenId"`; Owner string `json:"owner"`; Metadata map[string]string `json:"metadata"`; History []string `json:"history"`}
type State struct{Assets map[string]NFT `json:"assets"`}
type Module struct{mu sync.RWMutex; state State}
func New()*Module{return &Module{state:State{Assets:map[string]NFT{}}}}
func (m *Module)Name()string{return "axe721"}
func (m *Module)ApplyEvent(e models.DomainEvent) error {m.mu.Lock(); defer m.mu.Unlock(); id:=e.TxID; m.state.Assets[id]=NFT{TokenID:id,Owner:"indexer",Metadata:map[string]string{"source":"bitcoin"},History:[]string{"mint"}}; return nil}
func (m *Module)ApplyAction(a models.Action) error {m.mu.Lock(); defer m.mu.Unlock(); id,_:=a.Data["tokenId"].(string); if id==""{return nil}; n:=m.state.Assets[id]; switch a.Type{case "mint": n=NFT{TokenID:id,Owner:"owner",Metadata:map[string]string{"name":id},History:[]string{"mint"}}; case "transfer": to,_:=a.Data["to"].(string); n.Owner=to; n.History=append(n.History,"transfer"); case "metadata_update": k,_:=a.Data["key"].(string); v,_:=a.Data["value"].(string); if n.Metadata==nil{n.Metadata=map[string]string{}}; n.Metadata[k]=v; n.History=append(n.History,"metadata_update")}; m.state.Assets[id]=n; return nil}
func (m *Module)GetState() any {m.mu.RLock(); defer m.mu.RUnlock(); return m.state}
