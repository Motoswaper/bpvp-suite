package axe721

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"axe-market-suite/backend/internal/shared/models"
)

type ExternalRepresentation struct {
	Network         string            `json:"network"`
	Standard        string            `json:"standard"`
	Contract        string            `json:"contract"`
	ExternalTokenID string            `json:"externalTokenId"`
	BridgeState     string            `json:"bridgeState"`
	LastSyncUnix    int64             `json:"lastSyncUnix"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

type BridgeJob struct {
	ID              int64    `json:"id"`
	Type            string   `json:"type"`
	TokenID         string   `json:"tokenId"`
	Network         string   `json:"network"`
	Standard        string   `json:"standard"`
	Contract        string   `json:"contract"`
	ExternalTokenID string   `json:"externalTokenId,omitempty"`
	Status          string   `json:"status"`
	RequestedBy     string   `json:"requestedBy,omitempty"`
	ApprovedBy      string   `json:"approvedBy,omitempty"`
	Approvers       []string `json:"approvers,omitempty"`
	TxHash          string   `json:"txHash,omitempty"`
	Error           string   `json:"error,omitempty"`
	CreatedAt       int64    `json:"createdAt"`
	UpdatedAt       int64    `json:"updatedAt"`
}

type BridgePolicy struct {
	RequireDualApproval bool     `json:"requireDualApproval"`
	AllowedNetworks     []string `json:"allowedNetworks,omitempty"`
	AllowedStandards    []string `json:"allowedStandards,omitempty"`
	AllowedContracts    []string `json:"allowedContracts,omitempty"`
}

type NFT struct {
	TokenID         string                            `json:"tokenId"`
	Owner           string                            `json:"owner"`
	Metadata        map[string]string                 `json:"metadata"`
	History         []string                          `json:"history"`
	Representations map[string]ExternalRepresentation `json:"representations,omitempty"`
}

type State struct {
	Assets          map[string]NFT `json:"assets"`
	BridgeJobs      []BridgeJob    `json:"bridgeJobs"`
	NextBridgeJobID int64          `json:"nextBridgeJobId"`
	BridgePolicy    BridgePolicy   `json:"bridgePolicy"`
}
type Module struct {
	mu    sync.RWMutex
	state State
}

func New() *Module {
	return &Module{
		state: State{
			Assets:          map[string]NFT{},
			BridgeJobs:      []BridgeJob{},
			NextBridgeJobID: 1,
			BridgePolicy: BridgePolicy{
				RequireDualApproval: true,
			},
		},
	}
}
func (m *Module) Name() string { return "bpvp721" }

func bridgeEnabled() bool {
	return strings.ToLower(strings.TrimSpace(os.Getenv("BPVP_ENABLE_BRIDGE"))) == "true"
}

func (m *Module) ApplyEvent(e models.DomainEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := e.TxID
	m.state.Assets[id] = NFT{
		TokenID: id,
		Owner:   "indexer",
		Metadata: map[string]string{
			"source": "bitcoin",
		},
		History:         []string{"mint"},
		Representations: map[string]ExternalRepresentation{},
	}
	return nil
}

func normalizeRepKey(network, standard string) string {
	return strings.ToLower(strings.TrimSpace(network)) + ":" + strings.ToLower(strings.TrimSpace(standard))
}

func getString(data map[string]any, key string) string {
	v, _ := data[key].(string)
	return strings.TrimSpace(v)
}

func getInt64(data map[string]any, key string) int64 {
	if n, ok := data[key].(float64); ok {
		return int64(n)
	}
	return 0
}

func getBool(data map[string]any, key string, fallback bool) bool {
	v, ok := data[key].(bool)
	if !ok {
		return fallback
	}
	return v
}

func getStringList(data map[string]any, key string) []string {
	raw, ok := data[key].([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
			out = append(out, strings.TrimSpace(s))
		}
	}
	return out
}

func containsStringFold(values []string, target string) bool {
	t := strings.ToLower(strings.TrimSpace(target))
	for _, v := range values {
		if strings.ToLower(strings.TrimSpace(v)) == t {
			return true
		}
	}
	return false
}

func containsString(values []string, target string) bool {
	for _, v := range values {
		if v == target {
			return true
		}
	}
	return false
}

func (m *Module) ensureAsset(tokenID string) NFT {
	n := m.state.Assets[tokenID]
	if n.TokenID == "" {
		n = NFT{
			TokenID: tokenID,
			Owner:   "owner",
			Metadata: map[string]string{
				"name": tokenID,
			},
			History:         []string{"mint"},
			Representations: map[string]ExternalRepresentation{},
		}
	}
	if n.Metadata == nil {
		n.Metadata = map[string]string{}
	}
	if n.Representations == nil {
		n.Representations = map[string]ExternalRepresentation{}
	}
	return n
}

func (m *Module) enqueueBridgeJob(a models.Action) error {
	tokenID := getString(a.Data, "tokenId")
	network := getString(a.Data, "network")
	standard := getString(a.Data, "standard")
	contract := getString(a.Data, "contract")
	externalTokenID := getString(a.Data, "externalTokenId")
	requestedBy := getString(a.Data, "requestedBy")
	if tokenID == "" || network == "" || standard == "" || contract == "" {
		return fmt.Errorf("bridge enqueue requires tokenId, network, standard, contract")
	}
	policy := m.state.BridgePolicy
	if len(policy.AllowedNetworks) > 0 && !containsStringFold(policy.AllowedNetworks, network) {
		return fmt.Errorf("network not allowed by bridge policy")
	}
	if len(policy.AllowedStandards) > 0 && !containsStringFold(policy.AllowedStandards, standard) {
		return fmt.Errorf("standard not allowed by bridge policy")
	}
	if len(policy.AllowedContracts) > 0 && !containsStringFold(policy.AllowedContracts, contract) {
		return fmt.Errorf("contract not allowed by bridge policy")
	}
	jobType := strings.TrimPrefix(a.Type, "bridge_enqueue_")
	now := unixNow()
	job := BridgeJob{
		ID:              m.state.NextBridgeJobID,
		Type:            jobType,
		TokenID:         tokenID,
		Network:         network,
		Standard:        standard,
		Contract:        contract,
		ExternalTokenID: externalTokenID,
		Status:          "queued",
		RequestedBy:     requestedBy,
		Approvers:       []string{},
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	m.state.NextBridgeJobID++
	m.state.BridgeJobs = append(m.state.BridgeJobs, job)
	n := m.ensureAsset(tokenID)
	n.History = append(n.History, "bridge_enqueue_"+jobType)
	m.state.Assets[tokenID] = n
	return nil
}

func (m *Module) findJob(jobID int64) (int, bool) {
	for i := range m.state.BridgeJobs {
		if m.state.BridgeJobs[i].ID == jobID {
			return i, true
		}
	}
	return -1, false
}

func (m *Module) updateRepresentationForJob(job BridgeJob) {
	n := m.ensureAsset(job.TokenID)
	key := normalizeRepKey(job.Network, job.Standard)
	rep := n.Representations[key]
	if rep.Network == "" {
		rep = ExternalRepresentation{
			Network:         job.Network,
			Standard:        job.Standard,
			Contract:        job.Contract,
			ExternalTokenID: job.ExternalTokenID,
			BridgeState:     "linked",
			LastSyncUnix:    unixNow(),
			Metadata:        map[string]string{},
		}
	}
	if job.ExternalTokenID != "" {
		rep.ExternalTokenID = job.ExternalTokenID
	}
	rep.Contract = job.Contract
	rep.LastSyncUnix = unixNow()
	switch job.Type {
	case "mint":
		rep.BridgeState = "minted"
	case "burn":
		rep.BridgeState = "burned"
	case "sync":
		rep.BridgeState = "synced"
	}
	n.Representations[key] = rep
	n.History = append(n.History, "bridge_"+job.Type+"_confirmed")
	m.state.Assets[job.TokenID] = n
}

func (m *Module) ApplyAction(a models.Action) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, _ := a.Data["tokenId"].(string)
	n := NFT{}
	if id != "" {
		n = m.ensureAsset(id)
	}

	switch a.Type {
	case "mint":
		if id == "" {
			return fmt.Errorf("mint requires tokenId")
		}
		n = NFT{
			TokenID: id,
			Owner:   "owner",
			Metadata: map[string]string{
				"name": id,
			},
			History:         []string{"mint"},
			Representations: map[string]ExternalRepresentation{},
		}
	case "transfer":
		if id == "" {
			return fmt.Errorf("transfer requires tokenId")
		}
		to, _ := a.Data["to"].(string)
		n.Owner = to
		n.History = append(n.History, "transfer")
	case "metadata_update":
		if id == "" {
			return fmt.Errorf("metadata_update requires tokenId")
		}
		k, _ := a.Data["key"].(string)
		v, _ := a.Data["value"].(string)
		if n.Metadata == nil {
			n.Metadata = map[string]string{}
		}
		n.Metadata[k] = v
		n.History = append(n.History, "metadata_update")
	case "representation_link":
		if !bridgeEnabled() {
			return fmt.Errorf("bridge functionality disabled (native-only mode)")
		}
		if id == "" {
			return fmt.Errorf("representation_link requires tokenId")
		}
		network := getString(a.Data, "network")
		standard := getString(a.Data, "standard")
		contract := getString(a.Data, "contract")
		externalTokenID := getString(a.Data, "externalTokenId")
		bridgeState := getString(a.Data, "bridgeState")
		if network == "" || standard == "" || contract == "" || externalTokenID == "" {
			return fmt.Errorf("representation_link requires network, standard, contract, externalTokenId")
		}
		if bridgeState == "" {
			bridgeState = "linked"
		}
		key := normalizeRepKey(network, standard)
		n.Representations[key] = ExternalRepresentation{
			Network:         network,
			Standard:        standard,
			Contract:        contract,
			ExternalTokenID: externalTokenID,
			BridgeState:     bridgeState,
			LastSyncUnix:    unixNow(),
			Metadata:        map[string]string{},
		}
		n.History = append(n.History, "representation_link")
	case "representation_set_state":
		if !bridgeEnabled() {
			return fmt.Errorf("bridge functionality disabled (native-only mode)")
		}
		if id == "" {
			return fmt.Errorf("representation_set_state requires tokenId")
		}
		network := getString(a.Data, "network")
		standard := getString(a.Data, "standard")
		bridgeState := getString(a.Data, "bridgeState")
		if network == "" || standard == "" || bridgeState == "" {
			return fmt.Errorf("representation_set_state requires network, standard, bridgeState")
		}
		key := normalizeRepKey(network, standard)
		rep, ok := n.Representations[key]
		if !ok {
			return fmt.Errorf("representation not found")
		}
		rep.BridgeState = bridgeState
		rep.LastSyncUnix = unixNow()
		n.Representations[key] = rep
		n.History = append(n.History, "representation_set_state")
	case "bridge_enqueue_mint", "bridge_enqueue_burn", "bridge_enqueue_sync":
		if !bridgeEnabled() {
			return fmt.Errorf("bridge functionality disabled (native-only mode)")
		}
		return m.enqueueBridgeJob(a)
	case "bridge_set_policy":
		if !bridgeEnabled() {
			return fmt.Errorf("bridge functionality disabled (native-only mode)")
		}
		m.state.BridgePolicy = BridgePolicy{
			RequireDualApproval: getBool(a.Data, "requireDualApproval", m.state.BridgePolicy.RequireDualApproval),
			AllowedNetworks:     getStringList(a.Data, "allowedNetworks"),
			AllowedStandards:    getStringList(a.Data, "allowedStandards"),
			AllowedContracts:    getStringList(a.Data, "allowedContracts"),
		}
		return nil
	case "bridge_approve_job":
		if !bridgeEnabled() {
			return fmt.Errorf("bridge functionality disabled (native-only mode)")
		}
		jobID := getInt64(a.Data, "jobId")
		approver := getString(a.Data, "approver")
		if jobID <= 0 || approver == "" {
			return fmt.Errorf("bridge_approve_job requires jobId and approver")
		}
		i, ok := m.findJob(jobID)
		if !ok {
			return fmt.Errorf("bridge job not found")
		}
		job := m.state.BridgeJobs[i]
		if job.Status == "failed" || job.Status == "confirmed" {
			return fmt.Errorf("cannot approve finalized bridge job")
		}
		if !containsString(job.Approvers, approver) {
			job.Approvers = append(job.Approvers, approver)
		}
		requiredApprovals := 1
		if m.state.BridgePolicy.RequireDualApproval {
			requiredApprovals = 2
		}
		if len(job.Approvers) >= requiredApprovals {
			job.Status = "approved"
			job.ApprovedBy = approver
		} else {
			job.Status = "queued"
		}
		job.UpdatedAt = unixNow()
		m.state.BridgeJobs[i] = job
		n := m.ensureAsset(job.TokenID)
		n.History = append(n.History, "bridge_job_approved")
		m.state.Assets[n.TokenID] = n
		return nil
	case "bridge_mark_submitted":
		if !bridgeEnabled() {
			return fmt.Errorf("bridge functionality disabled (native-only mode)")
		}
		jobID := getInt64(a.Data, "jobId")
		txHash := getString(a.Data, "txHash")
		if jobID <= 0 || txHash == "" {
			return fmt.Errorf("bridge_mark_submitted requires jobId and txHash")
		}
		i, ok := m.findJob(jobID)
		if !ok {
			return fmt.Errorf("bridge job not found")
		}
		if m.state.BridgeJobs[i].Status != "approved" {
			return fmt.Errorf("bridge job must be approved before submission")
		}
		m.state.BridgeJobs[i].Status = "submitted"
		m.state.BridgeJobs[i].TxHash = txHash
		m.state.BridgeJobs[i].UpdatedAt = unixNow()
		return nil
	case "bridge_mark_confirmed":
		if !bridgeEnabled() {
			return fmt.Errorf("bridge functionality disabled (native-only mode)")
		}
		jobID := getInt64(a.Data, "jobId")
		if jobID <= 0 {
			return fmt.Errorf("bridge_mark_confirmed requires jobId")
		}
		i, ok := m.findJob(jobID)
		if !ok {
			return fmt.Errorf("bridge job not found")
		}
		if m.state.BridgeJobs[i].Status != "submitted" {
			return fmt.Errorf("bridge job must be submitted before confirmation")
		}
		if txHash := getString(a.Data, "txHash"); txHash != "" {
			m.state.BridgeJobs[i].TxHash = txHash
		}
		if externalTokenID := getString(a.Data, "externalTokenId"); externalTokenID != "" {
			m.state.BridgeJobs[i].ExternalTokenID = externalTokenID
		}
		m.state.BridgeJobs[i].Status = "confirmed"
		m.state.BridgeJobs[i].UpdatedAt = unixNow()
		m.updateRepresentationForJob(m.state.BridgeJobs[i])
		return nil
	case "bridge_mark_failed":
		if !bridgeEnabled() {
			return fmt.Errorf("bridge functionality disabled (native-only mode)")
		}
		jobID := getInt64(a.Data, "jobId")
		errorText := getString(a.Data, "error")
		if jobID <= 0 {
			return fmt.Errorf("bridge_mark_failed requires jobId")
		}
		i, ok := m.findJob(jobID)
		if !ok {
			return fmt.Errorf("bridge job not found")
		}
		if m.state.BridgeJobs[i].Status == "confirmed" {
			return fmt.Errorf("bridge job already confirmed")
		}
		if errorText == "" {
			errorText = "bridge action failed"
		}
		m.state.BridgeJobs[i].Status = "failed"
		m.state.BridgeJobs[i].Error = errorText
		m.state.BridgeJobs[i].UpdatedAt = unixNow()
		n := m.ensureAsset(m.state.BridgeJobs[i].TokenID)
		n.History = append(n.History, "bridge_job_failed")
		m.state.Assets[n.TokenID] = n
		return nil
	}
	if id != "" {
		m.state.Assets[id] = n
	}
	return nil
}

func (m *Module) GetState() any { m.mu.RLock(); defer m.mu.RUnlock(); return m.state }

func unixNow() int64 {
	return time.Now().Unix()
}
