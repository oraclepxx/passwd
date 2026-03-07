package backend

import (
	"context"
)

// App struct — Wails binds public methods on this to the frontend.
type App struct {
	ctx context.Context
}

// NewApp creates a new App instance.
func NewApp() *App {
	return &App{}
}

// Startup is called by Wails when the app starts.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}
