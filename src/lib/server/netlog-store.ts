// The Net Log store (kfdc #992): an append-only JSONL transcript plus the
// last digest, kept in a directory OUTSIDE the build tree so observation
// survives restarts and redeploys. Factory takes the directory so tests can
// point it anywhere; the wiring in netlog.ts picks the real one.

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Board } from '../board';
import { diffDigests, digestBoard, type Digest, type NetLogLine } from '../netlog';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface NetLogStore {
	observe(board: Board): NetLogLine[];
	recent(n?: number): NetLogLine[];
	compact(now: number): void;
}

export function createNetLogStore(dir: string): NetLogStore {
	const logPath = join(dir, 'netlog.jsonl');
	const digestPath = join(dir, 'last-digest.json');
	mkdirSync(dir, { recursive: true });

	let last: Digest | null = readDigest();

	function readDigest(): Digest | null {
		try {
			const d = JSON.parse(readFileSync(digestPath, 'utf8'));
			return d?.v === 1 ? (d as Digest) : null;
		} catch {
			return null;
		}
	}

	function readAll(): NetLogLine[] {
		let raw: string;
		try {
			raw = readFileSync(logPath, 'utf8');
		} catch {
			return [];
		}
		const out: NetLogLine[] = [];
		for (const line of raw.split('\n')) {
			if (!line) continue;
			try {
				out.push(JSON.parse(line) as NetLogLine);
			} catch {
				// A torn line loses itself, not the transcript.
			}
		}
		return out;
	}

	function observe(board: Board): NetLogLine[] {
		const next = digestBoard(board);
		// Same or older assembly than what we already digested — not a new
		// observation (a re-read or a stale response), so no diff.
		if (last && Date.parse(next.generated) <= Date.parse(last.generated)) return [];
		// First-ever observation has nothing to diff against: baseline only.
		const lines = last ? diffDigests(last, next) : [];
		if (lines.length)
			appendFileSync(logPath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
		writeFileSync(digestPath, JSON.stringify(next));
		last = next;
		return lines;
	}

	function recent(n = 20): NetLogLine[] {
		return readAll().slice(-n).reverse();
	}

	function compact(now: number): void {
		const all = readAll();
		const kept = all.filter((l) => now - Date.parse(l.observed) < RETENTION_MS);
		if (kept.length !== all.length)
			writeFileSync(logPath, kept.map((l) => JSON.stringify(l) + '\n').join(''));
	}

	return { observe, recent, compact };
}
