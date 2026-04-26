package handlers

import ("encoding/json";"net/http";"strconv";"axe-market-suite/backend/internal/core/metrics";"axe-market-suite/backend/internal/shared/models";"github.com/go-chi/chi/v5")
type EngineHandlerService interface {Status() map[string]any; ModuleState(string) (json.RawMessage,error); ApplyAction(models.Action) error}
type IndexerHandlerService interface {Status() map[string]any; Height() int64; Events(int64,int64) ([]models.DomainEvent,error)}
type WatcherHandlerService interface {Status() map[string]any}
type Handler struct{engine EngineHandlerService; indexer IndexerHandlerService; watcher WatcherHandlerService; metrics *metrics.Registry}
func New(e EngineHandlerService,i IndexerHandlerService,w WatcherHandlerService, m *metrics.Registry)*Handler{return &Handler{engine:e,indexer:i,watcher:w,metrics:m}}
func (h *Handler)Health(w http.ResponseWriter,_ *http.Request){writeJSON(w,http.StatusOK,map[string]any{"ok":true})}
func (h *Handler)Ready(w http.ResponseWriter,_ *http.Request){
    checks:=map[string]any{}
    ok:=true

    if h.engine!=nil{
        s:=h.engine.Status()
        stateHash,_:=s["stateHash"].(string)
        checks["engine"] = map[string]any{"ready": stateHash!=""}
        if stateHash==""{ ok=false }
    }
    if h.indexer!=nil{
        s:=h.indexer.Status()
        _, hasProcessed := s["processedBlocks"]
        btcHealthy, hasHealth := s["bitcoinHealthy"].(bool)
        idxHealthy, hasIdxHealth := s["indexerHealthy"].(bool)
        ready := hasProcessed && (!hasHealth || btcHealthy) && (!hasIdxHealth || idxHealthy)
        checks["indexer"] = map[string]any{"ready": ready, "bitcoinHealthy": btcHealthy, "indexerHealthy": idxHealthy}
        if !ready{ ok=false }
    }
    if h.watcher!=nil{
        s:=h.watcher.Status()
        eurl,_:=s["engineURL"].(string)
        iurl,_:=s["indexerURL"].(string)
        lagHealthy, hasLagHealthy := s["syncLagHealthy"].(bool)
        ready := eurl!="" && iurl!="" && (!hasLagHealthy || lagHealthy)
        checks["watcher"] = map[string]any{"ready": ready, "syncLagHealthy": lagHealthy}
        if !ready{ ok=false }
    }

    if !ok{
        writeJSON(w,http.StatusServiceUnavailable,map[string]any{"ok":false,"checks":checks})
        return
    }
    writeJSON(w,http.StatusOK,map[string]any{"ok":true,"checks":checks})
}
func (h *Handler)Status(w http.ResponseWriter,_ *http.Request){p:=map[string]any{}; if h.engine!=nil{p["engine"]=h.engine.Status()}; if h.indexer!=nil{p["indexer"]=h.indexer.Status()}; if h.watcher!=nil{p["watcher"]=h.watcher.Status()}; writeJSON(w,http.StatusOK,p)}
func (h *Handler)Metrics(w http.ResponseWriter,_ *http.Request){if h.metrics==nil{w.WriteHeader(http.StatusNoContent); return}; w.Header().Set("Content-Type","text/plain; version=0.0.4"); _,_ = w.Write([]byte(h.metrics.Prometheus()))}
func (h *Handler)State(w http.ResponseWriter,r *http.Request){if h.engine==nil{writeJSON(w,http.StatusNotImplemented,map[string]any{"error":"engine not configured"}); return}; module:=chi.URLParam(r,"module"); st,err:=h.engine.ModuleState(module); if err!=nil{writeJSON(w,http.StatusNotFound,map[string]any{"error":err.Error()}); return}; w.Header().Set("Content-Type","application/json"); w.WriteHeader(http.StatusOK); _,_ = w.Write(st)}
func (h *Handler)Actions(w http.ResponseWriter,r *http.Request){if h.engine==nil{writeJSON(w,http.StatusNotImplemented,map[string]any{"error":"engine not configured"}); return}; var a models.Action; if err:=json.NewDecoder(r.Body).Decode(&a); err!=nil{writeJSON(w,http.StatusBadRequest,map[string]any{"error":"invalid payload"}); return}; if err:=h.engine.ApplyAction(a); err!=nil{writeJSON(w,http.StatusBadRequest,map[string]any{"error":err.Error()}); return}; writeJSON(w,http.StatusOK,map[string]any{"applied":true})}
func (h *Handler)Height(w http.ResponseWriter,_ *http.Request){if h.indexer==nil{writeJSON(w,http.StatusNotImplemented,map[string]any{"error":"indexer not configured"}); return}; writeJSON(w,http.StatusOK,map[string]any{"height":h.indexer.Height()})}
func (h *Handler)Events(w http.ResponseWriter,r *http.Request){if h.indexer==nil{writeJSON(w,http.StatusNotImplemented,map[string]any{"error":"indexer not configured"}); return}; from,_:=strconv.ParseInt(r.URL.Query().Get("fromHeight"),10,64); to,_:=strconv.ParseInt(r.URL.Query().Get("toHeight"),10,64); if to==0{to=from+20}; evts,err:=h.indexer.Events(from,to); if err!=nil{writeJSON(w,http.StatusBadRequest,map[string]any{"error":err.Error()}); return}; writeJSON(w,http.StatusOK,map[string]any{"events":evts})}
func writeJSON(w http.ResponseWriter,status int,p any){w.Header().Set("Content-Type","application/json"); w.WriteHeader(status); _=json.NewEncoder(w).Encode(p)}
