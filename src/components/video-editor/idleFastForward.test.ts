import { describe, expect, it } from "vitest";
import { findIdleSpans, planIdleFastForward } from "./idleFastForward";
import type { ClipRegion, CursorTelemetryPoint } from "./types";

/** Samples every 100 ms from 0 to endMs; `moves` lists times where the cursor jumps. */
function telemetry(
	endMs: number,
	moves: number[] = [],
	clicks: number[] = [],
): CursorTelemetryPoint[] {
	const points: CursorTelemetryPoint[] = [];
	let x = 0.5;
	for (let timeMs = 0; timeMs <= endMs; timeMs += 100) {
		if (moves.includes(timeMs)) x += 0.05;
		points.push({
			timeMs,
			cx: x,
			cy: 0.5,
			interactionType: clicks.includes(timeMs) ? "click" : "move",
		});
	}
	return points;
}

const clip = (overrides: Partial<ClipRegion> = {}): ClipRegion => ({
	id: "clip-1",
	startMs: 0,
	endMs: 10_000,
	speed: 1,
	...overrides,
});

describe("findIdleSpans", () => {
	it("finds stretches where the cursor neither moves nor clicks", () => {
		expect(findIdleSpans(telemetry(10_000, [3000, 3100]), { minIdleMs: 2000 })).toEqual([
			{ startMs: 0, endMs: 3000 },
			{ startMs: 3100, endMs: 10_000 },
		]);
	});

	it("treats clicks as activity even when the cursor does not move", () => {
		expect(findIdleSpans(telemetry(10_000, [], [5000]), { minIdleMs: 2000 })).toEqual([
			{ startMs: 0, endMs: 5000 },
			{ startMs: 5000, endMs: 10_000 },
		]);
	});

	it("ignores pauses shorter than the minimum", () => {
		expect(findIdleSpans(telemetry(4000, [1000, 2500]), { minIdleMs: 2000 })).toEqual([]);
	});

	it("ignores sub-threshold jitter", () => {
		const points = telemetry(5000).map((p, i) => ({ ...p, cx: p.cx + (i % 2) * 0.0005 }));
		expect(findIdleSpans(points, { minIdleMs: 2000 })).toEqual([{ startMs: 0, endMs: 5000 }]);
	});
});

describe("planIdleFastForward", () => {
	let nextId = 2;
	const createId = () => `clip-${nextId++}`;

	it("splits a clip so idle stretches play fast and keeps a margin around activity", () => {
		const plan = planIdleFastForward({
			clipRegions: [clip({ muted: true })],
			idleSpans: [{ startMs: 3000, endMs: 9000 }],
			speed: 4,
			marginMs: 400,
			createId,
		});
		expect(plan).not.toBeNull();
		const pieces = plan!.clips.map(({ startMs, endMs, sourceStartMs, speed, muted }) => ({
			startMs,
			endMs,
			sourceStartMs,
			speed,
			muted,
		}));
		expect(pieces).toEqual([
			{ startMs: 0, endMs: 3400, sourceStartMs: 0, speed: 1, muted: true },
			{ startMs: 3400, endMs: 4700, sourceStartMs: 3400, speed: 4, muted: true },
			{ startMs: 4700, endMs: 6100, sourceStartMs: 8600, speed: 1, muted: true },
		]);
		expect(plan!.spanCount).toBe(1);
		expect(plan!.savedMs).toBe(3900);
		expect(new Set(plan!.clips.map(({ id }) => id)).size).toBe(3);
	});

	it("absorbs a sliver of activity at a clip edge into the fast piece", () => {
		const plan = planIdleFastForward({
			clipRegions: [clip()],
			idleSpans: [{ startMs: 0, endMs: 10_000 }],
			speed: 4,
			marginMs: 100,
			createId,
		});
		expect(plan!.clips.map(({ speed, sourceStartMs }) => [speed, sourceStartMs])).toEqual([
			[4, 0],
		]);
		expect(plan!.clips[0].endMs).toBe(2500);
	});

	it("leaves clips that already have a custom speed alone", () => {
		expect(
			planIdleFastForward({
				clipRegions: [clip({ speed: 2, endMs: 5000 })],
				idleSpans: [{ startMs: 0, endMs: 10_000 }],
				createId,
			}),
		).toBeNull();
	});

	it("returns null when nothing idle is long enough after the margins", () => {
		expect(
			planIdleFastForward({
				clipRegions: [clip()],
				idleSpans: [{ startMs: 4000, endMs: 5500 }],
				marginMs: 400,
				minSpanMs: 1000,
				createId,
			}),
		).toBeNull();
	});

	it("maps idle time through a clip that starts later in the source", () => {
		const plan = planIdleFastForward({
			clipRegions: [clip({ startMs: 0, endMs: 4000, sourceStartMs: 6000 })],
			idleSpans: [{ startMs: 0, endMs: 8000 }],
			speed: 4,
			marginMs: 0,
			createId,
		});
		expect(
			plan!.clips.map(({ sourceStartMs, speed, startMs, endMs }) => [
				sourceStartMs,
				speed,
				startMs,
				endMs,
			]),
		).toEqual([
			[6000, 4, 0, 500],
			[8000, 1, 500, 2500],
		]);
	});
});
