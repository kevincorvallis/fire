import { afterEach, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createUntitledProject } from "./createUntitledProject";
const dirs: string[] = [];
afterEach(async () => {
	await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});
it("publishes complete, uniquely named projects under concurrent creation without replacing existing projects", async () => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "recordly-new-"));
	dirs.push(dir);
	await fs.writeFile(path.join(dir, "Untitled Project.fire"), "original");
	const paths = await Promise.all(
		[1, 2, 3].map((n) => createUntitledProject(dir, JSON.stringify({ id: n }))),
	);
	expect(paths.map((p) => path.basename(p)).sort()).toEqual([
		"Untitled Project 1.fire",
		"Untitled Project 2.fire",
		"Untitled Project 3.fire",
	]);
	expect(await fs.readFile(path.join(dir, "Untitled Project.fire"), "utf8")).toBe("original");
	for (let i = 0; i < paths.length; i++)
		expect(JSON.parse(await fs.readFile(paths[i], "utf8"))).toEqual({ id: i + 1 });
	expect((await fs.readdir(dir)).filter((p) => p.endsWith(".tmp"))).toEqual([]);
});
