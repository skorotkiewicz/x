#!/usr/bin/env node
'use strict';

const SHELVES_PER_WALL = 5;
const VOLUMES_PER_SHELF = 32;
const PAGES_PER_VOLUME = 410;
const WALLS = [1, 2, 3, 4];
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz, .';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const PAGE_LINE_COUNT = 40;
const PAGE_COLUMN_COUNT = 80;
const PAGE_SYMBOL_COUNT = PAGE_LINE_COUNT * PAGE_COLUMN_COUNT;
const PAGE_RADIX = BigInt(ALPHABET.length);
const PAGE_HALF_SYMBOL_COUNT = PAGE_SYMBOL_COUNT / 2;
const PAGE_HALF_SPACE = PAGE_RADIX ** BigInt(PAGE_HALF_SYMBOL_COUNT);
const PAGE_SPACE = PAGE_HALF_SPACE * PAGE_HALF_SPACE;
const PAGES_PER_ROOM = BigInt(4 * SHELVES_PER_WALL * VOLUMES_PER_SHELF * PAGES_PER_VOLUME);
const PAGE_LCG_A = PAGE_SPACE - (1n << 1024n) + 2n;
const PAGE_LCG_C = PAGE_SPACE - (1n << 768n) + 2n;
const PAGE_FEISTEL_KEYS = [
	0x9e3779b97f4a7c15n,
	0xbf58476d1ce4e5b9n,
	0x94d049bb133111ebn,
	0x2545f4914f6cdd1dn,
	0xda942042e4dd58b5n
];

let pageLcgAInverse = null;

function usage() {
	console.log(`Usage:
  node search.js "text to find" [options]

Options:
  --direct           Compute one whole-library location directly. Default without scan options
  --scan             Brute-force finite rooms with the options below
  --q N              Center room q coordinate. Default: 0
  --r N              Center room r coordinate. Default: 0
  --radius N         Search hex rooms within radius. Default: 0
  --rooms N          Search this many rooms, moving outward from q,r
  --wall N           Search one wall, 1-4
  --shelf N          Search one shelf, 1-5
  --volume N         Search one volume, 1-32
  --page N           Search one page, 1-410
  --max-results N    Stop after this many matches. Default: 1
  --case-sensitive   Match exact letter case
  --help             Show this help

Examples:
  node search.js "wizard"
  node search.js "wxyz, zzz."
  node search.js "abc" --scan --q 4 --r -2 --wall 1 --shelf 3
  node search.js "abc" --scan --radius 1 --max-results 10
`);
}

function parseArgs(argv) {
	const opts = {
		q: 0n,
		r: 0n,
		radius: 0,
		radiusSet: false,
		rooms: null,
		wall: null,
		shelf: null,
		volume: null,
		page: null,
		maxResults: 1,
		caseSensitive: false,
		direct: false,
		scan: false,
		scanOptionSet: false
	};
	const terms = [];

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--help' || arg === '-h') {
			opts.help = true;
			continue;
		}
		if (arg === '--case-sensitive') {
			opts.caseSensitive = true;
			continue;
		}
		if (arg === '--direct') {
			opts.direct = true;
			continue;
		}
		if (arg === '--scan') {
			opts.scan = true;
			continue;
		}
		if (!arg.startsWith('--')) {
			terms.push(arg);
			continue;
		}

		const value = argv[++i];
		if (value === undefined) throw new Error(`Missing value for ${arg}`);

		if (arg === '--q') {
			opts.q = parseIntegerBigInt(value, arg);
			opts.scanOptionSet = true;
		} else if (arg === '--r') {
			opts.r = parseIntegerBigInt(value, arg);
			opts.scanOptionSet = true;
		} else {
			const n = Number.parseInt(value, 10);
			if (!Number.isFinite(n)) throw new Error(`Expected a number for ${arg}, got "${value}"`);
			if (arg === '--radius') {
				opts.radius = n;
				opts.radiusSet = true;
				opts.scanOptionSet = true;
			} else if (arg === '--rooms') {
				opts.rooms = n;
				opts.scanOptionSet = true;
			} else if (arg === '--wall') {
				opts.wall = n;
				opts.scanOptionSet = true;
			} else if (arg === '--shelf') {
				opts.shelf = n;
				opts.scanOptionSet = true;
			} else if (arg === '--volume') {
				opts.volume = n;
				opts.scanOptionSet = true;
			} else if (arg === '--page') {
				opts.page = n;
				opts.scanOptionSet = true;
			} else if (arg === '--max-results') opts.maxResults = n;
			else throw new Error(`Unknown option: ${arg}`);
		}
	}

	opts.query = terms.join(' ');
	if (!opts.direct && !opts.scan) opts.scan = opts.scanOptionSet;
	if (!opts.direct && !opts.scan) opts.direct = true;
	return opts;
}

function parseIntegerBigInt(value, name) {
	if (!/^-?\d+$/.test(value)) throw new Error(`Expected an integer for ${name}, got "${value}"`);
	return BigInt(value);
}

function assertRange(name, value, min, max) {
	if (value === null) return;
	if (value < min || value > max) {
		throw new Error(`${name} must be between ${min} and ${max}`);
	}
}

function validate(opts) {
	if (opts.help) return;
	if (!opts.query) throw new Error('Search text is required.');
	if (opts.direct && opts.scan) throw new Error('Use either --direct or --scan, not both');
	if (opts.radius < 0) throw new Error('radius must be 0 or greater');
	if (opts.rooms !== null && opts.rooms < 1) throw new Error('rooms must be 1 or greater');
	if (opts.rooms !== null && opts.radiusSet)
		throw new Error('Use either --rooms or --radius, not both');
	if (opts.maxResults < 1) throw new Error('max-results must be 1 or greater');
	assertRange('wall', opts.wall, 1, 4);
	assertRange('shelf', opts.shelf, 1, SHELVES_PER_WALL);
	assertRange('volume', opts.volume, 1, VOLUMES_PER_SHELF);
	assertRange('page', opts.page, 1, PAGES_PER_VOLUME);
}

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
	let state = permutePageState(pageAddressIndex(book, page));
	const lines = [];
	for (let line = 0; line < PAGE_LINE_COUNT; line++) {
		let s = '';
		for (let col = 0; col < PAGE_COLUMN_COUNT; col++) {
			const idx = Number(state % PAGE_RADIX);
			s += ALPHABET[idx];
			state /= PAGE_RADIX;
		}
		lines.push(s);
	}
	return lines.join('\n');
}

function pageAddressIndex(book, page) {
	const roomIndex = cantorPair(signedToNatural(book.q), signedToNatural(book.r));
	const wallIndex = BigInt(book.wall - 1);
	const shelfIndex = BigInt(book.shelf - 1);
	const volumeIndex = BigInt(book.volume - 1);
	const pageIndex = BigInt(page - 1);
	const bookPageIndex =
		((wallIndex * BigInt(SHELVES_PER_WALL) + shelfIndex) * BigInt(VOLUMES_PER_SHELF) +
			volumeIndex) *
			BigInt(PAGES_PER_VOLUME) +
		pageIndex;

	return (roomIndex * PAGES_PER_ROOM + bookPageIndex) % PAGE_SPACE;
}

function findTextInLibrary(text) {
	const pageState = encodeSearchPageState(text);
	const addressIndex = invertPageState(pageState);
	return decodePageAddress(addressIndex);
}

function encodeSearchPageState(text) {
	const rand = mulberry32(fnv1a(`${text}|search-fill`));
	let state = 0n;
	let place = 1n;

	for (let position = 0; position < PAGE_SYMBOL_COUNT; position++) {
		const character =
			position < text.length ? text[position] : ALPHABET[Math.floor(rand() * ALPHABET.length)];
		const index = BigInt(ALPHABET.indexOf(character));
		state += index * place;
		place *= PAGE_RADIX;
	}

	return state;
}

function permutePageState(index) {
	let state = (PAGE_LCG_A * index + PAGE_LCG_C) % PAGE_SPACE;
	let left = state / PAGE_HALF_SPACE;
	let right = state % PAGE_HALF_SPACE;

	for (const key of PAGE_FEISTEL_KEYS) {
		const mixed = positiveMod(left + pageRoundFunction(right, key), PAGE_HALF_SPACE);
		left = right;
		right = mixed;
	}

	return left * PAGE_HALF_SPACE + right;
}

function invertPageState(pageState) {
	let left = pageState / PAGE_HALF_SPACE;
	let right = pageState % PAGE_HALF_SPACE;

	for (let index = PAGE_FEISTEL_KEYS.length - 1; index >= 0; index--) {
		const key = PAGE_FEISTEL_KEYS[index];
		const previousLeft = positiveMod(right - pageRoundFunction(left, key), PAGE_HALF_SPACE);
		right = left;
		left = previousLeft;
	}

	const lcgState = left * PAGE_HALF_SPACE + right;
	return positiveMod(
		getPageLcgAInverse() * positiveMod(lcgState - PAGE_LCG_C, PAGE_SPACE),
		PAGE_SPACE
	);
}

function decodePageAddress(index) {
	let bookPageIndex = index % PAGES_PER_ROOM;
	const roomIndex = index / PAGES_PER_ROOM;

	const page = Number(bookPageIndex % BigInt(PAGES_PER_VOLUME)) + 1;
	bookPageIndex /= BigInt(PAGES_PER_VOLUME);
	const volume = Number(bookPageIndex % BigInt(VOLUMES_PER_SHELF)) + 1;
	bookPageIndex /= BigInt(VOLUMES_PER_SHELF);
	const shelf = Number(bookPageIndex % BigInt(SHELVES_PER_WALL)) + 1;
	bookPageIndex /= BigInt(SHELVES_PER_WALL);
	const wall = Number(bookPageIndex) + 1;
	const [naturalQ, naturalR] = cantorUnpair(roomIndex);
	const q = naturalToSigned(naturalQ);
	const r = naturalToSigned(naturalR);
	const book = { q, r, wall, shelf, volume };

	return { book, page };
}

function pageRoundFunction(value, key) {
	let mixed = positiveMod(value + key, PAGE_HALF_SPACE);
	mixed = positiveMod(mixed * (PAGE_LCG_A % PAGE_HALF_SPACE) + PAGE_LCG_C + key, PAGE_HALF_SPACE);
	mixed ^= mixed >> 97n;
	mixed = positiveMod(mixed * 0x9e3779b97f4a7c15n + key, PAGE_HALF_SPACE);
	mixed ^= mixed >> 53n;
	return positiveMod(mixed, PAGE_HALF_SPACE);
}

function getPageLcgAInverse() {
	pageLcgAInverse ??= modularInverse(PAGE_LCG_A, PAGE_SPACE);
	return pageLcgAInverse;
}

function modularInverse(value, modulus) {
	let previousCoefficient = 0n;
	let coefficient = 1n;
	let previousRemainder = modulus;
	let remainder = positiveMod(value, modulus);

	while (remainder !== 0n) {
		const quotient = previousRemainder / remainder;
		[previousCoefficient, coefficient] = [
			coefficient,
			previousCoefficient - quotient * coefficient
		];
		[previousRemainder, remainder] = [remainder, previousRemainder - quotient * remainder];
	}

	if (previousRemainder !== 1n) {
		throw new Error('Page permutation is not invertible.');
	}

	return positiveMod(previousCoefficient, modulus);
}

function signedToNatural(value) {
	return value >= 0n ? value * 2n : -value * 2n - 1n;
}

function naturalToSigned(value) {
	return value % 2n === 0n ? value / 2n : -(value + 1n) / 2n;
}

function cantorPair(a, b) {
	const sum = a + b;
	return (sum * (sum + 1n)) / 2n + b;
}

function cantorUnpair(value) {
	const diagonal = (integerSqrt(8n * value + 1n) - 1n) / 2n;
	const diagonalStart = (diagonal * (diagonal + 1n)) / 2n;
	const b = value - diagonalStart;
	return [diagonal - b, b];
}

function integerSqrt(value) {
	if (value < 0n) throw new Error('Cannot take square root of a negative bigint.');
	if (value < 2n) return value;

	let estimate = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
	while (true) {
		const next = (estimate + value / estimate) >> 1n;
		if (next >= estimate) return estimate;
		estimate = next;
	}
}

function positiveMod(value, modulus) {
	const result = value % modulus;
	return result >= 0n ? result : result + modulus;
}

function normalizeLibrarySearchText(input) {
	const text = input.toLowerCase().replace(/\s+/g, ' ').trim();
	if (!text) return { text, error: 'Search text is required.' };
	if (text.length > PAGE_SYMBOL_COUNT) {
		return { text, error: `Search text must fit within ${PAGE_SYMBOL_COUNT} symbols.` };
	}

	const unsupported = [...new Set([...text].filter((character) => !ALPHABET.includes(character)))];
	if (unsupported.length > 0) {
		return {
			text,
			error: `Unsupported symbols for this library: ${unsupported.join(' ')}`
		};
	}

	return { text, error: '' };
}

function* hexRooms(centerQ, centerR, radius) {
	for (let dq = -radius; dq <= radius; dq++) {
		const rMin = Math.max(-radius, -dq - radius);
		const rMax = Math.min(radius, -dq + radius);
		for (let dr = rMin; dr <= rMax; dr++) {
			yield { q: centerQ + BigInt(dq), r: centerR + BigInt(dr) };
		}
	}
}

function* outwardRooms(centerQ, centerR) {
	const directions = [
		{ q: 1n, r: 0n },
		{ q: 0n, r: 1n },
		{ q: -1n, r: 1n },
		{ q: -1n, r: 0n },
		{ q: 0n, r: -1n },
		{ q: 1n, r: -1n }
	];

	yield { q: centerQ, r: centerR };
	for (let radius = 1; ; radius++) {
		let q = centerQ + directions[4].q * BigInt(radius);
		let r = centerR + directions[4].r * BigInt(radius);
		for (const direction of directions) {
			for (let step = 0; step < radius; step++) {
				yield { q, r };
				q += direction.q;
				r += direction.r;
			}
		}
	}
}

function* limitedRooms(centerQ, centerR, limit) {
	let count = 0;
	for (const room of outwardRooms(centerQ, centerR)) {
		if (count >= limit) return;
		count++;
		yield room;
	}
}

function rangeOrOne(value, all) {
	return value === null ? all : [value];
}

function lineColumn(index) {
	return {
		line: Math.floor(index / 81) + 1,
		column: (index % 81) + 1
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

function directSearch(opts) {
	const normalized = normalizeLibrarySearchText(opts.query);
	if (normalized.error) throw new Error(normalized.error);

	const { book, page } = findTextInLibrary(normalized.text);
	const title = makeTitle(`${book.q},${book.r},${book.wall},${book.shelf},${book.volume}`);
	const pageText = generatePageText(book, page);
	const index = pageText.indexOf(normalized.text);
	const displayIndex = index === -1 ? 0 : index;
	const pos = index === -1 ? { line: 1, column: 1 } : lineColumn(index);

	console.log('Match 1');
	console.log(bookAddressString(book, page));
	console.log(`title: ${title}`);
	console.log(`line:${pos.line} column:${pos.column}`);
	console.log(`excerpt: ${excerpt(pageText, displayIndex, normalized.text.length)}`);
	console.log('');

	return { found: 1, searchedPages: 1, searchedRooms: 1 };
}

function search(opts) {
	const needle = opts.caseSensitive ? opts.query : opts.query.toLowerCase();
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
	let searchedPages = 0;
	let searchedRooms = 0;
	let found = 0;
	const rooms =
		opts.rooms === null
			? hexRooms(opts.q, opts.r, opts.radius)
			: limitedRooms(opts.q, opts.r, opts.rooms);

	for (const room of rooms) {
		searchedRooms++;
		for (const wall of walls) {
			for (const shelf of shelves) {
				for (const volume of volumes) {
					const book = { q: room.q, r: room.r, wall, shelf, volume };
					const title = makeTitle(`${book.q},${book.r},${book.wall},${book.shelf},${book.volume}`);
					for (const page of pages) {
						searchedPages++;
						const pageText = generatePageText(book, page);
						const haystack = opts.caseSensitive ? pageText : pageText.toLowerCase();
						let index = haystack.indexOf(needle);
						while (index !== -1) {
							const pos = lineColumn(index);
							found++;
							console.log(`Match ${found}`);
							console.log(bookAddressString(book, page));
							console.log(`title: ${title}`);
							console.log(`line:${pos.line} column:${pos.column}`);
							console.log(`excerpt: ${excerpt(pageText, index, opts.query.length)}`);
							console.log('');
							if (found >= opts.maxResults) return { found, searchedPages, searchedRooms };
							index = haystack.indexOf(needle, index + 1);
						}
					}
				}
			}
		}
	}

	return { found, searchedPages, searchedRooms };
}

function main() {
	let opts;
	try {
		opts = parseArgs(process.argv.slice(2));
		validate(opts);
	} catch (err) {
		console.error(`Error: ${err.message}`);
		console.error('');
		usage();
		process.exitCode = 1;
		return;
	}

	if (opts.help) {
		usage();
		return;
	}

	const started = Date.now();
	const result = opts.direct ? directSearch(opts) : search(opts);
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
