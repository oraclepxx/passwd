package vault

import (
	"fmt"
	"os/exec"
)

// ClipboardWrite writes text to the OS clipboard.
// On macOS it uses pbcopy; extend for other platforms as needed.
func ClipboardWrite(text string) error {
	cmd := exec.Command("pbcopy")
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("clipboard pipe: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("clipboard start: %w", err)
	}
	if _, err := fmt.Fprint(stdin, text); err != nil {
		return fmt.Errorf("clipboard write: %w", err)
	}
	stdin.Close()
	return cmd.Wait()
}
