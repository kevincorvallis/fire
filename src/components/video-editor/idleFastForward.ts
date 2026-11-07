// Fire feature: fast-forward the stretches of a recording where nothing happens.
// Idle = the cursor neither moves past a small threshold nor clicks.
import {
	type ClipRegion,
	type CursorTelemetryPoint,
	getClipSourceEndMs,
	getClipSourceStartMs,
} from "./types";

export interface IdleSpan {
	startMs: number;
	endMs: number;
}

const CLICK_TYPES = new Set(["click", "double-click", "right-click", "middle-click"]);
/** Activity shorter than this at a clip edge or between two idle stretches is folded in. */
const SLIVER_MS = 250;

/** Source-time stretches of at least `minIdleMs` with no cursor movement or clicks. */
export function findIdleSpans(
	points: CursorTelemetryPoint[],
	{
		minIdleMs = 2000,
		moveThreshold = 0.002,
		endMs,
	}: { minIdleMs?: number; moveThreshold?: number; endMs?: number } = {},
): IdleSpan[] {
	const sorted = points
		.filter((p) => Number.isFinite(p.timeMs) && Number.isFinite(p.cx) && Number.isFinite(p.cy))
		.sort((a, b) => a.timeMs - b.timeMs);
	if (sorted.length === 0) return [];

	const spans: IdleSpan[] = [];
	let anchor = sorted[0];
	let idleStart = anchor.timeMs;
	for (const point of sorted.slice(1)) {
		const moved = Math.hypot(point.cx - anchor.cx, point.cy - anchor.cy) > moveThreshold;
		const clicked =
			point.interactionType !== undefined && CLICK_TYPES.has(point.interactionType);
		if (!moved && !clicked) continue;
		if (point.timeMs - idleStart >= minIdleMs)
			spans.push({ startMs: idleStart, endMs: point.timeMs });
		anchor = point;
		idleStart = point.timeMs;
	}
	const end = Math.max(endMs ?? 0, sorted[sorted.length - 1].timeMs);
	if (end - idleStart >= minIdleMs) spans.push({ startMs: idleStart, endMs: end });
	return spans;
}

/**
 * Splits 1x clips around idle stretches and plays those pieces at `speed`. Clips that
 * already have a custom speed are left alone. Returns null when nothing would change.
 */
export function planIdleFastForward({
	clipRegions,
	idleSpans,
	speed = 4,
	marginMs = 400,
	minSpanMs = 1000,
	createId,
}: {
	clipRegions: ClipRegion[];
	idleSpans: IdleSpan[];
	speed?: number;
	marginMs?: number;
	minSpanMs?: number;
	createId: () => string;
}): { clips: ClipRegion[]; spanCount: number; savedMs: number } | null {
	const spans = [...idleSpans].sort((a, b) => a.startMs - b.startMs);
	const clips: ClipRegion[] = [];
	let spanCount = 0;
	let savedMs = 0;
	let offsetMs = 0;

	for (const clip of [...clipRegions].sort((a, b) => a.startMs - b.startMs)) {
		const startMs = clip.startMs + offsetMs;
		const sourceStart = getClipSourceStartMs(clip);
		const sourceEnd = getClipSourceEndMs(clip);
		const fast: Array<[number, number]> = [];
		if (clip.speed === 1) {
			let cursor = sourceStart;
			for (const span of spans) {
				let a = Math.max(span.startMs + marginMs, sourceStart);
				const b = Math.min(span.endMs - marginMs, sourceEnd);
				if (b - a < minSpanMs) continue;
				if (a - cursor < SLIVER_MS) a = cursor;
				const last = fast[fast.length - 1];
				if (last && last[1] === a) last[1] = b;
				else fast.push([a, b]);
				cursor = b;
			}
			const last = fast[fast.length - 1];
			if (last && sourceEnd - last[1] < SLIVER_MS) last[1] = sourceEnd;
		}

		if (fast.length === 0) {
			clips.push({ ...clip, startMs, endMs: clip.endMs + offsetMs });
			continue;
		}

		const pieces: Array<{ from: number; to: number; speed: number }> = [];
		let cursor = sourceStart;
		for (const [a, b] of fast) {
			if (a > cursor) pieces.push({ from: cursor, to: a, speed: 1 });
			pieces.push({ from: a, to: b, speed });
			cursor = b;
		}
		if (sourceEnd > cursor) pieces.push({ from: cursor, to: sourceEnd, speed: 1 });

		let t = startMs;
		pieces.forEach((piece, index) => {
			const duration = Math.max(1, Math.round((piece.to - piece.from) / piece.speed));
			clips.push({
				...clip,
				id: index === 0 ? clip.id : createId(),
				startMs: t,
				endMs: t + duration,
				sourceStartMs: piece.from,
				speed: piece.speed,
			});
			if (piece.speed !== 1) {
				spanCount += 1;
				savedMs += piece.to - piece.from - duration;
			}
			t += duration;
		});
		offsetMs += t - startMs - (clip.endMs - clip.startMs);
	}

	return spanCount > 0 ? { clips, spanCount, savedMs } : null;
}
