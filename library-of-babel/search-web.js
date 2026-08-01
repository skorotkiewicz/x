#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const searchCli = path.join(__dirname, 'search.js');
const args = process.argv.slice(2);

function run(searchArgs, capture = false) {
	const result = spawnSync(process.execPath, [searchCli, ...searchArgs], {
		encoding: 'utf8',
		stdio: capture ? 'pipe' : 'inherit'
	});
	if (result.error) throw result.error;
	return result;
}

if (args.includes('--self-test')) {
	const result = run(
		[
			'yovqp,rzyswm',
			'--scan',
			'--q',
			'0',
			'--r',
			'0',
			'--wall',
			'1',
			'--shelf',
			'1',
			'--volume',
			'1',
			'--page',
			'1'
		],
		true
	);
	const matchesFixture =
		result.stdout.includes('hex(q:0, r:0, s:0) / wall:1 / shelf:1 / volume:1 / page:1') &&
		result.stdout.includes('title: vznmc uqixjf') &&
		result.stdout.includes('line:1 column:1');
	if (result.status !== 0 || !matchesFixture) {
		process.stderr.write(result.stderr || result.stdout || 'Browser generator parity check failed.\n');
		process.exitCode = 1;
	} else {
		console.log('Browser generator parity check passed.');
	}
} else if (args.includes('--help') || args.includes('-h')) {
	console.log(`Usage:
  node search-web.js "text to find" [scan options]
  node search-web.js --self-test

This command scans pages from the same generator as the browser explorer.
Run node search.js --help to see all scan options.`);
} else {
	const result = run([...args, '--scan']);
	process.exitCode = result.status ?? 1;
}
