package main

import (
	"fmt"
	"os"
	"path/filepath"

	"axe-market-suite/backend/internal/engine"
)

func main() {
	dataDir := os.Getenv("AXE_DATA_DIR")
	if dataDir == "" {
		dataDir = "./data"
	}
	journalPath := filepath.Join(dataDir, "engine-journal.ndjson")
	j, err := engine.NewJournal(journalPath)
	if err != nil {
		panic(err)
	}
	if err := j.VerifyIntegrity(); err != nil {
		fmt.Println("journal verification failed:", err)
		os.Exit(1)
	}
	fmt.Println("journal verification passed")
}
