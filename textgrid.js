"use strict";

function textGrid(grid, file) {
	const transcript = {
		words: {},
		phones: {}
	};
	const lines = grid.split("\n");
	let intervals = 0;
	let size = 2;
	let mode;
	let prev;
	while (lines.length) {
		const line = lines.shift().trim();
		if (line.endsWith("<exists>")) {
			size = parseInt(lines.shift().split("=").pop().trim());
		} else if (line.endsWith("\"IntervalTier\"")) {
			intervals++;
			prev = undefined;
			mode = intervals === size ? "phones" : "words";
			for (let i = 0; i < 3; i++) {
				lines.shift();
			}
			const count = parseInt(lines.shift().split("=").pop());
			for (let j = 0; j < count; j++) {
				let xmin = lines.shift();
				if (xmin.match(/\[[0-9]+\]:/)) {
					xmin = lines.shift();
				}
				xmin = parseFloat(xmin.split("=").pop());
				const xmax = parseFloat(lines.shift().split("=").pop());
				let text = lines.shift().split("=").pop().trim().slice(1, -1);
				if (mode === "words") {
					text = text.toLowerCase();
				}
				if (prev) {
					transcript[mode][prev][transcript[mode][prev].length - 1].next = text;
				}
				transcript[mode][text] = transcript[mode][text] || [];
				const data = {
					start: xmin,
					end: xmax,
					dur: xmax - xmin,
					phone: text,
					prev: prev,
					file: file
				};
				transcript[mode][text].push(data);
				if (mode === "phones") {
					for (let word in transcript.words) {
						for (let i = 0; i < transcript.words[word].length; i++) {
							const phone = transcript.words[word][i];
							if (xmin >= phone.start && xmax <= phone.end) {
								phone.phones = phone.phones || [];
								phone.phones.push(data);
							}
						}
					}
				}
				prev = text;
			}
		}
	}
	return transcript;
}

module.exports = textGrid;