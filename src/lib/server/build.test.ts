// #2190. The board's answer to "which kfdc am I?" is a file the bundle ships,
// so these are the file's failure modes — and the one that matters most is
// ABSENCE, because absence is the ordinary answer in development and must not
// look like a version.
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildId, readBuildId, VERSION_FILE } from './build';

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'kfdc-build-'));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

const at = (name: string, body: string) => {
	const p = join(dir, name);
	writeFileSync(p, body);
	return p;
};

describe('readBuildId', () => {
	// The shape the package store publishes and knarr verifies: package.json's
	// version plus the short commit. Asserted as the real thing rather than a
	// placeholder, because the whole value of this field is that it names a
	// commit somebody can check out.
	it('reads the published version label', () => {
		expect(readBuildId(at(VERSION_FILE, '0.5.0-f2b1b19\n'))).toBe('0.5.0-f2b1b19');
	});

	it('trims the trailing newline the publish recipe writes', () => {
		expect(readBuildId(at('v-nl', '0.5.0-f2b1b19\n'))).toBe('0.5.0-f2b1b19');
		expect(readBuildId(at('v-none', '0.5.0-f2b1b19'))).toBe('0.5.0-f2b1b19');
	});

	// Every way of having no answer gives the SAME answer, and it is null rather
	// than a string. A placeholder here — 'unknown', 'dev', '' — would compare
	// unequal to a real version and so would reload a dev board on its first
	// poll, which is the failure this nullability exists to make unreachable.
	it('says null when there is no stamp at all', () => {
		expect(readBuildId(join(dir, 'nope'))).toBeNull();
	});

	it('says null for an empty stamp', () => {
		expect(readBuildId(at('empty', ''))).toBeNull();
	});

	it('says null for a whitespace-only stamp', () => {
		expect(readBuildId(at('blank', '  \n\t\n'))).toBeNull();
	});

	it('says null rather than throwing when the path is a directory', () => {
		const d = join(dir, 'adir');
		mkdirSync(d);
		expect(readBuildId(d)).toBeNull();
	});

	// The production path, asserted rather than assumed: the unit pins
	// `WorkingDirectory` to the unpacked version directory and the bundle puts
	// VERSION at its root, so the default argument is a bare relative name that
	// resolves against the process CWD. Verified on the live service on kubsdb —
	// /proc/<pid>/cwd is the version directory and VERSION is in it.
	it('defaults to a CWD-relative name, which is where the unit puts it', () => {
		expect(VERSION_FILE).toBe('VERSION');
	});
});

describe('buildId', () => {
	// It cannot change without a restart, because a deploy IS a restart: knarr
	// repoints `current` by rename(2) and then restarts the unit. So re-reading
	// would be asking a question whose answer the process already is.
	it('answers the same thing every time', () => {
		expect(buildId()).toBe(buildId());
	});

	// Running under vitest there is no bundle, so this is also the dev answer —
	// and it being null is the thing that keeps `npm run dev` off the reload path.
	it('is null in a tree with no VERSION stamp', () => {
		expect(buildId()).toBeNull();
	});
});
