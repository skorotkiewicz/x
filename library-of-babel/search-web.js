#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

const SHELVES_PER_WALL = 5;
const VOLUMES_PER_SHELF = 32;
const PAGES_PER_VOLUME = 410;
const WALLS = [1, 2, 3, 4];
const ALPHABET = 'abcdefghijklmnopqrstuv, .';
const LETTERS = 'abcdefghijklmnopqrstuv';
const PAGE_LINE_COUNT = 40;
const PAGE_COLUMN_COUNT = 80;

function usage() {
	console.log(`Usage:
  node search-web.js "text to find" [options]

Options:
  --q N              Center room q coordinate. Default: 0
  --r N              Center room r coordinate. Default: 0
  --radius N         Search hex rooms within radius. Default: 0
  --rooms N          Search this many rooms, moving outward from q,r
  --wall N           Search one wall, 1-4
  --shelf N          Search one shelf, 1-5
  --volume N         Search one volume, 1-32
  --page N           Search one page, 1-410
  --max-results N    Stop after this many matches. Default: 1
  --self-test        Check parity with the browser generator
  --help             Show this help

Examples:
  node search-web.js "wizard" --q 0 --r 0
  node search-web.js "abc" --radius 1 --max-results 10
  node search-web.js "lvgq" --wall 1 --shelf 1 --volume 1 --page 1
`);
}

function parseSafeInteger(value, name) {
	if (!/^-?\d+$/.test(value)) throw new Error(`Expected an integer for ${name}, got "${value}"`);
	const number = Number(value);
	if (!Number.isSafeInteger(number)) throw new Error(`${name} must be a safe integer`);
	return number;
}

function parseArgs(argv) {
	const opts = {
		q: 0,
		r: 0,
		radius: 0,
		radiusSet: false,
		rooms: null,
		wall: null,
		shelf: null,
		volume: null,
		page: null,
		maxResults: 1,
		help: false,
		selfTest: false
	};
	const terms = [];

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--help' || arg === '-h') {
			opts.help = true;
			continue;
		}
		if (arg === '--self-test') {
			opts.selfTest = true;
			continue;
		}
		if (!arg.startsWith('--')) {
			terms.push(arg);
			continue;
		}

		const value = argv[++i];
		if (value === undefined) throw new Error(`Missing value for ${arg}`);
		const number = parseSafeInteger(value, arg);

		if (arg === '--q') opts.q = number;
		else if (arg === '--r') opts.r = number;
		else if (arg === '--radius') {
			opts.radius = number;
			opts.radiusSet = true;
		} else if (arg === '--rooms') opts.rooms = number;
		else if (arg === '--wall') opts.wall = number;
		else if (arg === '--shelf') opts.shelf = number;
		else if (arg === '--volume') opts.volume = number;
		else if (arg === '--page') opts.page = number;
		else if (arg === '--max-results') opts.maxResults = number;
		else throw new Error(`Unknown option: ${arg}`);
	}

	opts.query = terms.join(' ');
	return opts;
}

function assertRange(name, value, min, max) {
	if (value !== null && (value < min || value > max)) {
		throw new Error(`${name} must be between ${min} and ${max}`);
	}
}

function validate(opts) {
	if (opts.help || opts.selfTest) return;
	if (!opts.query) throw new Error('Search text is required.');
	if (opts.radius < 0) throw new Error('radius must be 0 or greater');
	if (opts.rooms !== null && opts.rooms < 1) throw new Error('rooms must be 1 or greater');
	if (opts.rooms !== null && opts.radiusSet) {
		throw new Error('Use either --rooms or --radius, not both');
	}
	if (opts.maxResults < 1) throw new Error('max-results must be 1 or greater');
	assertRange('wall', opts.wall, 1, 4);
	assertRange('shelf', opts.shelf, 1, SHELVES_PER_WALL);
	assertRange('volume', opts.volume, 1, VOLUMES_PER_SHELF);
	assertRange('page', opts.page, 1, PAGES_PER_VOLUME);
}

// Keep these functions behaviorally equivalent to the browser generator.
function fnv1a(str) {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

function mulberry32(seed) {
	return function () {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeTitle(address) {
	const rand = mulberry32(fnv1a(address + '|title'));
	const words = 1 + Math.floor(rand() * 3);
	const out = [];
	for (let w = 0; w < words; w++) {
		const len = 3 + Math.floor(rand() * 6);
		let word = '';
		for (let c = 0; c < len; c++) word += LETTERS[Math.floor(rand() * LETTERS.length)];
		out.push(word);
	}
	return out.join(' ');
}

function generatePageText(book, page) {
	const key = `${book.q},${book.r}|w${book.wall}|s${book.shelf}|v${book.volume}|p${page}`;
	const rand = mulberry32(fnv1a(key));
	const lines = [];
	for (let line = 0; line < PAGE_LINE_COUNT; line++) {
		let text = '';
		for (let column = 0; column < PAGE_COLUMN_COUNT; column++) {
			text += ALPHABET[Math.floor(rand() * ALPHABET.length)];
		}
		lines.push(text);
	}
	return lines.join('\n');
}

function* hexRooms(centerQ, centerR, radius) {
	for (let dq = -radius; dq <= radius; dq++) {
		const rMin = Math.max(-radius, -dq - radius);
		const rMax = Math.min(radius, -dq + radius);
		for (let dr = rMin; dr <= rMax; dr++) {
			yield safeRoom(centerQ + dq, centerR + dr);
		}
	}
}

function* outwardRooms(centerQ, centerR) {
	const directions = [
		{ q: 1, r: 0 },
		{ q: 0, r: 1 },
		{ q: -1, r: 1 },
		{ q: -1, r: 0 },
		{ q: 0, r: -1 },
		{ q: 1, r: -1 }
	];

	yield { q: centerQ, r: centerR };
	for (let radius = 1; ; radius++) {
		let q = centerQ + directions[4].q * radius;
		let r = centerR + directions[4].r * radius;
		for (const direction of directions) {
			for (let step = 0; step < radius; step++) {
				yield safeRoom(q, r);
				q += direction.q;
				r += direction.r;
			}
		}
	}
}

function* limitedRooms(centerQ, centerR, limit) {
	let count = 0;
	for (const room of outwardRooms(centerQ, centerR)) {
		if (count++ >= limit) return;
		yield room;
	}
}

function safeRoom(q, r) {
	if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) {
		throw new Error('Room coordinates exceed the browser safe-integer range');
	}
	return { q, r };
}

function rangeOrOne(value, all) {
	return value === null ? all : [value];
}

function findMatches(text, query) {
	const matches = [];
	let start = 0;
	while (start < text.length) {
		const index = text.indexOf(query, start);
		if (index === -1) break;
		matches.push(index);
		start = index + Math.max(query.length, 1);
	}
	return matches;
}

function lineColumn(index) {
	return {
		line: Math.floor(index / (PAGE_COLUMN_COUNT + 1)) + 1,
		column: (index % (PAGE_COLUMN_COUNT + 1)) + 1
	};
}

function excerpt(text, index, length) {
	const start = Math.max(0, index - 36);
	const end = Math.min(text.length, index + length + 36);
	return text.slice(start, end).replace(/\n/g, '\\n');
}

function bookAddressString(book, page) {
	const s = -book.q - book.r;
	return `hex(q:${book.q}, r:${book.r}, s:${s}) / wall:${book.wall} / shelf:${book.shelf} / volume:${book.volume} / page:${page}`;
}

function search(opts) {
	const query = opts.query.toLowerCase();
	const walls = rangeOrOne(opts.wall, WALLS);
	const shelves = rangeOrOne(
		opts.shelf,
		Array.from({ length: SHELVES_PER_WALL }, (_, i) => i + 1)
	);
	const volumes = rangeOrOne(
		opts.volume,
		Array.from({ length: VOLUMES_PER_SHELF }, (_, i) => i + 1)
	);
	const pages = rangeOrOne(
		opts.page,
		Array.from({ length: PAGES_PER_VOLUME }, (_, i) => i + 1)
	);
	const rooms =
		opts.rooms === null
			? hexRooms(opts.q, opts.r, opts.radius)
			: limitedRooms(opts.q, opts.r, opts.rooms);
	let searchedPages = 0;
	let searchedRooms = 0;
	let found = 0;

	for (const room of rooms) {
		searchedRooms++;
		for (const wall of walls) {
			for (const shelf of shelves) {
				for (const volume of volumes) {
					const book = { ...room, wall, shelf, volume };
					const title = makeTitle(`${book.q},${book.r},${wall},${shelf},${volume}`);
					for (const page of pages) {
						searchedPages++;
						const pageText = generatePageText(book, page);
						for (const index of findMatches(pageText.toLowerCase(), query)) {
							const position = lineColumn(index);
							found++;
							console.log(`Match ${found}`);
							console.log(bookAddressString(book, page));
							console.log(`title: ${title}`);
							console.log(`line:${position.line} column:${position.column}`);
							console.log(`excerpt: ${excerpt(pageText, index, query.length)}`);
							console.log('');
							if (found >= opts.maxResults) return { found, searchedPages, searchedRooms };
						}
					}
				}
			}
		}
	}

	return { found, searchedPages, searchedRooms };
}

function selfTest() {
	const book = { q: 0, r: 0, wall: 1, shelf: 1, volume: 1 };
	const page = generatePageText(book, 1);
	assert.equal(makeTitle('0,0,1,1,1'), 'svlkc rnhtie');
	assert.equal(
		page.split('\n')[0],
		'lvgqbdl.dcolape. frskleeeikn.,ua,j sameb,im.fticm,aqfbo hems qk  semfuotq.en,.m '
	);
	assert.equal(fnv1a(page), 1268859806);
	assert.equal(page.length, PAGE_LINE_COUNT * PAGE_COLUMN_COUNT + PAGE_LINE_COUNT - 1);
	console.log('Browser generator parity check passed.');
}

function main() {
	let opts;
	try {
		opts = parseArgs(process.argv.slice(2));
		validate(opts);
	} catch (error) {
		console.error(`Error: ${error.message}\n`);
		usage();
		process.exitCode = 1;
		return;
	}

	if (opts.help) return usage();
	if (opts.selfTest) return selfTest();

	const started = Date.now();
	const result = search(opts);
	const seconds = ((Date.now() - started) / 1000).toFixed(2);
	if (result.found === 0) {
		console.log(
			`No matches found after searching ${result.searchedPages} pages across ${result.searchedRooms} rooms.`
		);
	}
	console.log(
		`Searched ${result.searchedPages} pages across ${result.searchedRooms} rooms in ${seconds}s.`
	);
}

main();
