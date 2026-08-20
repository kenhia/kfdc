// The installed app's identity (#1494, sprint 018), gated.
//
// What kfdc can actually get wrong here is not a type error: it is a manifest
// that names an icon nobody shipped, or that declares a size the file is not.
// Both fail SILENTLY — Chromium skips an icon it cannot use and falls back to
// the synthesised monogram tile, which is the exact bug this sprint fixed. And
// neither shows up in `just check`'s other gates: no test imports these files,
// the build copies `static/` verbatim without looking inside it, and the only
// honest reproduction is uninstalling and reinstalling a web app on Windows.
//
// So: read the manifest, read the PNGs' own headers, and hold the two to each
// other. No dependency — a PNG's IHDR is at a fixed offset.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const STATIC = new URL('../static/', import.meta.url);
const APP_HTML = readFileSync(new URL('./app.html', import.meta.url), 'utf8');

interface ManifestIcon {
	src: string;
	sizes: string;
	type: string;
	purpose?: string;
}
interface Manifest {
	name: string;
	short_name: string;
	start_url: string;
	display: string;
	theme_color: string;
	background_color: string;
	icons: ManifestIcon[];
}

const manifest = JSON.parse(
	readFileSync(new URL('manifest.webmanifest', STATIC), 'utf8')
) as Manifest;

/** A PNG's real dimensions, from its IHDR: 8-byte signature, then a 4-byte
 *  length and the `IHDR` tag, then width and height as big-endian uint32. */
function pngSize(file: string): { w: number; h: number } {
	const buf = readFileSync(new URL(file, STATIC));
	expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
	return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('installed app identity', () => {
	// The install path wants a raster of at least 128px and reads it from the
	// manifest. Nothing else in the repo asserts these exist.
	it('names icons that are actually shipped, at the sizes it claims', () => {
		expect(manifest.icons.length).toBeGreaterThan(0);
		for (const icon of manifest.icons) {
			expect(icon.src.startsWith('/')).toBe(true);
			const { w, h } = pngSize(icon.src.slice(1));
			expect(`${w}x${h}`).toBe(icon.sizes);
			expect(icon.type).toBe('image/png');
		}
	});

	// 192 and 512 are the two Chromium actually shops for. A manifest holding
	// only, say, a 128 installs with a monogram and no error anywhere.
	it('covers the sizes the install path shops for', () => {
		const sizes = manifest.icons.map((i) => i.sizes);
		expect(sizes).toContain('192x192');
		expect(sizes).toContain('512x512');
	});

	// The reticle is drawn full-bleed on `#15170f`, so the same file serves both
	// purposes; a maskable icon with transparent margins would be letterboxed.
	it('offers a maskable purpose so the tile is not letterboxed', () => {
		expect(manifest.icons.some((i) => (i.purpose ?? 'any').split(/\s+/).includes('maskable'))).toBe(
			true
		);
	});

	it('declares the app the way the taskbar needs it', () => {
		expect(manifest.name).toBe('KFDC — Homelab Fire Direction');
		expect(manifest.short_name).toBe('KFDC');
		expect(manifest.start_url).toBe('/');
		expect(manifest.display).toBe('standalone');
	});

	// One ground colour, three places (app.css's page background, the meta tag,
	// the manifest). A splash screen in a different near-black than the board is
	// the kind of wrong nobody reports and everybody sees.
	it('agrees with app.html about the ground colour', () => {
		expect(manifest.theme_color).toBe('#15170f');
		expect(manifest.background_color).toBe('#15170f');
		expect(APP_HTML).toContain('<meta name="theme-color" content="#15170f" />');
	});

	// A manifest nothing links to is a manifest the install path never reads.
	it('is linked from app.html, along with every static asset app.html names', () => {
		expect(APP_HTML).toContain('rel="manifest"');
		const named = [...APP_HTML.matchAll(/%sveltekit\.assets%\/([^"]+)/g)].map((m) => m[1]);
		expect(named).toContain('manifest.webmanifest');
		for (const file of named) {
			expect(() => readFileSync(new URL(file, STATIC))).not.toThrow();
		}
	});
});
