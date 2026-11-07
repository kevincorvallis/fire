import type { BrowserWindow } from "electron";

export function createRecordingEditorNavigation(createEditor: () => BrowserWindow | void) {
	let returnWindow: BrowserWindow | null = null;
	return {
		setReturnWindow(window: BrowserWindow | null) {
			returnWindow = window;
		},
		open(reload = true) {
			const target = returnWindow;
			if (reload) returnWindow = null;
			if (!target || target.isDestroyed()) {
				const editor = createEditor();
				// Home opened from the HUD: remember this editor so the next finished
				// recording reloads it instead of leaving the dashboard as it was.
				if (!reload && editor) returnWindow = editor;
				return;
			}
			// Home flushed this editor's project before launching the HUD. Reload
			// from the finalized recording session, clearing the previous project UI.
			if (reload) target.reload();
			if (target.isMinimized()) target.restore();
			target.show();
			target.focus();
		},
	};
}
