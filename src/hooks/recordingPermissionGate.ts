type PermissionStatusApi = Pick<
	typeof window.electronAPI,
	"getPlatform" | "getScreenRecordingPermissionStatus" | "getAccessibilityPermissionStatus"
>;
type RecordingPermissionApi = PermissionStatusApi &
	Pick<typeof window.electronAPI, "showRecordingPermissions">;

/** True when macOS Screen Recording and Accessibility are both granted (always true elsewhere). */
export async function hasRecordingPermissions(api: PermissionStatusApi) {
	if ((await api.getPlatform()) !== "darwin") return true;
	const [screen, accessibility] = await Promise.all([
		api.getScreenRecordingPermissionStatus(),
		api.getAccessibilityPermissionStatus(),
	]);
	return (
		screen.success &&
		screen.status === "granted" &&
		accessibility.success &&
		accessibility.trusted
	);
}

/**
 * Resolves true when recording may start. Fire has no accounts, so only the macOS
 * Screen Recording and Accessibility permissions gate recording (upstream Recordly
 * also required a signed-in session here).
 */
export async function prepareRecordingPermissions(api: RecordingPermissionApi) {
	if (await hasRecordingPermissions(api)) return true;
	await api.showRecordingPermissions();
	return false;
}
