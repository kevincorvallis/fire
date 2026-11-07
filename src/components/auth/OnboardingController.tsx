import { Modal } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import { loadAppSetting, saveAppSetting } from "@/lib/appSettings";
import { OnboardingPermissions } from "./OnboardingPermissions";

const PERMISSIONS_REQUESTED_KEY = "recordly.onboarding.permissionsRequested";

/**
 * Fire has no accounts, so onboarding is only the macOS permissions step. It opens when
 * recording needs a permission, or when Settings asks to review them.
 */
export function OnboardingController({
	requestNonce,
	ready,
}: {
	requestNonce: number;
	ready: boolean;
}) {
	const [open, setOpen] = useState(false);
	useEffect(() => {
		if (requestNonce > 0) setOpen(true);
	}, [requestNonce]);
	useEffect(() => {
		if (ready && loadAppSetting<boolean>(PERMISSIONS_REQUESTED_KEY)) setOpen(true);
	}, [ready]);
	useEffect(() => window.electronAPI.onRecordingPermissionsRequested?.(() => setOpen(true)), []);

	const close = useCallback(() => {
		saveAppSetting(PERMISSIONS_REQUESTED_KEY, false);
		setOpen(false);
	}, []);
	const finish = () => {
		close();
		void window.electronAPI.showRecordingHud();
	};

	return (
		<Modal
			isOpen={open}
			onOpenChange={(value) => {
				if (!value) close();
			}}
		>
			<Modal.Backdrop>
				<Modal.Container size="lg" placement="center" className="p-4">
					<Modal.Dialog
						aria-label="Recording permissions"
						className="w-full max-w-[640px] gap-0 overflow-hidden rounded-3xl p-0 pb-4"
					>
						<OnboardingPermissions onBack={close} onFinish={finish} />
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
