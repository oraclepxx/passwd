package main

import (
	"embed"

	"github.com/oraclepxx/passwd/backend"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := backend.NewApp()

	appMenu := menu.NewMenuFromItems(
		menu.SubMenu("passwd", menu.NewMenuFromItems(
			menu.Text("Quit passwd", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
				runtime.Quit(app.GetContext())
			}),
		)),
		menu.EditMenu(),
	)

	err := wails.Run(&options.App{
		Title:  "passwd",
		Width:  480,
		Height: 720,
		Menu:   appMenu,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 249, G: 250, B: 251, A: 1},
		OnStartup:        app.Startup,
		OnShutdown:       app.Shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
