package engine

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"sync"

	"axe-market-suite/backend/internal/core/validation"
	"axe-market-suite/backend/internal/shared/errors"
	"axe-market-suite/backend/internal/shared/models"
)

type Module interface {
	Name() string
	ApplyEvent(models.DomainEvent) error
	ApplyAction(models.Action) error
	GetState() any
}
type Registry struct {
	modules map[string]Module
	aliases map[string]string
}

func NewRegistry() *Registry {
	return &Registry{modules: map[string]Module{}, aliases: map[string]string{}}
}
func (r *Registry) Register(m Module) { r.modules[m.Name()] = m }
func (r *Registry) RegisterAlias(alias, canonical string) {
	if alias != "" && canonical != "" {
		r.aliases[alias] = canonical
	}
}
func (r *Registry) canonicalName(name string) string {
	if c, ok := r.aliases[name]; ok {
		return c
	}
	return name
}
func (r *Registry) Module(name string) (Module, bool) {
	m, ok := r.modules[r.canonicalName(name)]
	return m, ok
}
func (r *Registry) ActiveModules() []string {
	out := make([]string, 0, len(r.modules))
	for k := range r.modules {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

type Engine struct {
	mu        sync.Mutex
	version   string
	height    int64
	stateHash string
	registry  *Registry
	journal   *Journal
}

func New(version string, reg *Registry, journal *Journal) *Engine {
	e := &Engine{version: version, registry: reg, journal: journal}
	_ = e.replayFromJournal()
	e.stateHash = e.computeStateHash()
	return e
}

func (e *Engine) ApplyAction(a models.Action) error {
	if err := validation.ValidateAction(a); err != nil {
		return err
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	m, ok := e.registry.Module(a.Module)
	if !ok {
		return fmt.Errorf("%w: %s", errors.ErrModuleNotFound, a.Module)
	}
	if err := m.ApplyAction(a); err != nil {
		return err
	}
	if e.journal != nil {
		_ = e.journal.Append(JournalEntry{Type: JournalTypeAction, Action: &a})
	}
	e.stateHash = e.computeStateHash()
	return nil
}

func (e *Engine) ApplyEvent(evt models.DomainEvent) error {
	if evt.SchemaVersion == "" {
		evt.SchemaVersion = models.CurrentDomainEventSchema
	}
	if err := validation.ValidateEvent(evt); err != nil {
		return err
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	m, ok := e.registry.Module(evt.Module)
	if !ok {
		return fmt.Errorf("%w: %s", errors.ErrModuleNotFound, evt.Module)
	}
	if evt.Height > e.height {
		e.height = evt.Height
	}
	if err := m.ApplyEvent(evt); err != nil {
		return err
	}
	if e.journal != nil {
		_ = e.journal.Append(JournalEntry{Type: JournalTypeEvent, Event: &evt})
	}
	e.stateHash = e.computeStateHash()
	return nil
}

func (e *Engine) Status() map[string]any {
	return map[string]any{"service": "axe-engine", "version": e.version, "height": e.height, "stateHash": e.stateHash, "modules": e.registry.ActiveModules()}
}
func (e *Engine) ModuleState(module string) (json.RawMessage, error) {
	m, ok := e.registry.Module(module)
	if !ok {
		return nil, fmt.Errorf("%w: %s", errors.ErrModuleNotFound, module)
	}
	raw, err := json.Marshal(m.GetState())
	if err != nil {
		return nil, err
	}
	return raw, nil
}

func (e *Engine) replayFromJournal() error {
	if e.journal == nil {
		return nil
	}
	entries, err := e.journal.ReadAll()
	if err != nil {
		return err
	}
	for _, entry := range entries {
		switch entry.Type {
		case JournalTypeAction:
			if entry.Action == nil {
				continue
			}
			m, ok := e.registry.Module(entry.Action.Module)
			if !ok {
				continue
			}
			if err := m.ApplyAction(*entry.Action); err != nil {
				return err
			}
		case JournalTypeEvent:
			if entry.Event == nil {
				continue
			}
			if entry.Event.SchemaVersion == "" {
				entry.Event.SchemaVersion = models.CurrentDomainEventSchema
			}
			m, ok := e.registry.Module(entry.Event.Module)
			if !ok {
				continue
			}
			if entry.Event.Height > e.height {
				e.height = entry.Event.Height
			}
			if err := m.ApplyEvent(*entry.Event); err != nil {
				return err
			}
		}
	}
	return nil
}

func (e *Engine) computeStateHash() string {
	moduleNames := e.registry.ActiveModules()
	snapshot := map[string]any{
		"height": e.height,
	}
	for _, name := range moduleNames {
		mod, ok := e.registry.Module(name)
		if ok {
			snapshot[name] = mod.GetState()
		}
	}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
