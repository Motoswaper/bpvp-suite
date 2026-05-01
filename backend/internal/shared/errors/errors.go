package errors

import "errors"

var (
	ErrModuleNotFound = errors.New("module not found")
	ErrInvalidAction  = errors.New("invalid action")
	ErrInvalidEvent   = errors.New("invalid event")
)
