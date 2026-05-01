package validation

import (
	"axe-market-suite/backend/internal/shared/errors"
	"axe-market-suite/backend/internal/shared/models"
)

func ValidateAction(a models.Action) error {
	if a.Module == "" || a.Type == "" {
		return errors.ErrInvalidAction
	}
	return nil
}
func ValidateEvent(e models.DomainEvent) error {
	if e.Module == "" || e.Type == "" || e.SchemaVersion == "" {
		return errors.ErrInvalidEvent
	}
	return nil
}
