import { describe, expect, it, vi } from "vitest";
import { hasRecordingPermissions, prepareRecordingPermissions } from "./recordingPermissionGate";

function createApi({
	platform = "darwin",
	screen = "granted",
	accessibility = true,
}: {
	platform?: string;
	screen?: string;
	accessibility?: boolean;
} = {}) {
	return {
		getPlatform: vi.fn(async () => platform),
		getScreenRecordingPermissionStatus: vi.fn(async () => ({ success: true, status: screen })),
		getAccessibilityPermissionStatus: vi.fn(async () => ({
			success: true,
			trusted: accessibility,
			prompted: false,
		})),
		showRecordingPermissions: vi.fn(async () => {}),
	};
}

describe("prepareRecordingPermissions", () => {
	it("allows recording without any signed-in account once macOS permissions are granted", async () => {
		const api = createApi();
		await expect(prepareRecordingPermissions(api)).resolves.toBe(true);
		expect(api.showRecordingPermissions).not.toHaveBeenCalled();
	});

	it("opens the permissions prompt when Screen Recording is missing", async () => {
		const api = createApi({ screen: "denied" });
		await expect(prepareRecordingPermissions(api)).resolves.toBe(false);
		expect(api.showRecordingPermissions).toHaveBeenCalledOnce();
	});

	it("opens the permissions prompt when Accessibility is missing", async () => {
		const api = createApi({ accessibility: false });
		await expect(prepareRecordingPermissions(api)).resolves.toBe(false);
		expect(api.showRecordingPermissions).toHaveBeenCalledOnce();
	});

	it("skips macOS permission checks on other platforms", async () => {
		const api = createApi({ platform: "win32", screen: "denied", accessibility: false });
		await expect(prepareRecordingPermissions(api)).resolves.toBe(true);
		expect(api.getScreenRecordingPermissionStatus).not.toHaveBeenCalled();
	});
});

describe("hasRecordingPermissions", () => {
	it("reports granted permissions without opening the prompt", async () => {
		const api = createApi();
		await expect(hasRecordingPermissions(api)).resolves.toBe(true);
		expect(api.showRecordingPermissions).not.toHaveBeenCalled();
	});

	it("reports missing permissions without opening the prompt", async () => {
		const api = createApi({ accessibility: false });
		await expect(hasRecordingPermissions(api)).resolves.toBe(false);
		expect(api.showRecordingPermissions).not.toHaveBeenCalled();
	});
});
