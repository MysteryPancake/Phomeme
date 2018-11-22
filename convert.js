"use strict";

const fs = require("fs");
const Session = require("./session.js");

function saveJson(transcript) {
	fs.writeFileSync("input.json", JSON.stringify(transcript, undefined, "\t"));
}

function process(phones) {
	const mix = new Session("session", 16, 16000);
	for (let phone in phones) {
		for (let i = 0; i < phones[phone].length; i++) {
			mix.addClip(phones[phone][i].file, phone, phones[phone][i].start, phones[phone][i].end, phones[phone][i].start, phones[phone][i].end, 1);
		}
	}
	mix.save();
}

function dictionary() {
	const dict = {};
	const lines = fs.readFileSync("WEBSITE/phonedictionary.txt", "utf8").split("\n");
	for (let i = 0; i < lines.length; i++) {
		const phones = lines[i].split(" ");
		dict[phones[0]] = phones.slice(1);
	}
	return dict;
}

function lookupJson() {
	return JSON.parse(fs.readFileSync("WEBSITE/lookup.json", "utf8"));
}

function convertSentence(sentence, matchPunctuation) {
	const words = sentence.toLowerCase().match(/\w+(?:'\w+)*|(?<![!?.])[!?.]/g);
	const punctuation = { "!": true, "?": true, ".": true };
	const dict = dictionary();
	const transcript = {
		transcript: sentence,
		words: [],
		phones: []
	};
	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		if (punctuation[word]) continue;
		transcript.words.push({
			prev: words[i - (matchPunctuation && punctuation[words[i - 1]] ? 1 : 2)],
			next: words[i + (matchPunctuation && punctuation[words[i + 1]] ? 1 : 2)],
			phone: word
		});
		const phones = dict[word];
		if (phones) {
			transcript.words[transcript.words.length - 1].phones = [];
			for (let j = 0; j < phones.length; j++) {
				const data = {
					prev: phones[j - 1],
					next: phones[j + 1],
					phone: phones[j]
				};
				transcript.words[transcript.words.length - 1].phones.push(data);
				transcript.phones.push(data);
			}
		} else {
			console.log("MISSING DEFINITION: " + word);
		}
	}
	return transcript;
}

function convertTextGrid(transcript, str, file) {
	const lookup = lookupJson();
	const lines = str.split("\n");
	let mode = "words";
	let intervals = 0;
	let size = 2;
	let prev;
	while (lines.length) {
		const line = lines.shift().trim();
		if (line.endsWith("<exists>")) {
			size = parseInt(lines.shift().split("=").pop().trim());
		} else if (line.endsWith("\"IntervalTier\"")) {
			intervals++;
			prev = undefined;
			for (let i = 0; i < 3; i++) {
				lines.shift();
			}
			if (mode) {
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
					} else {
						const match = lookup.textgrid[text];
						if (!match) {
							console.log("USING OOV FOR: " + text);
						}
						text = match || "OOV";
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
							for (let k = 0; k < transcript.words[word].length; k++) {
								const phone = transcript.words[word][k];
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
			mode = intervals + 1 === size && "phones";
		}
	}
	return transcript;
}

function convertJson(transcript, json, file, matchPunctuation) {
	let prev = {};
	const lookup = lookupJson();
	const punctuation = { "?": true, "!": true, ".": true };
	for (let i = 0; i < json.words.length; i++) {
		const word = json.words[i];
		if (word.case === "not-found-in-audio") continue;
		const aligned = word.word.toLowerCase();
		const char = json.transcript.charAt(word.endOffset);
		if (prev.word) {
			transcript.words[prev.word][transcript.words[prev.word].length - 1].next = matchPunctuation && punctuation[char] ? char : aligned;
		}
		transcript.words[aligned] = transcript.words[aligned] || [];
		transcript.words[aligned].push({
			start: word.start,
			end: word.end,
			dur: word.end - word.start,
			phone: aligned,
			prev: matchPunctuation && punctuation[char] ? prev.char : prev.word,
			phones: [],
			file: file
		});
		prev = { word: aligned, char: char };
		let start = word.start;
		for (let j = 0; j < word.phones.length; j++) {
			const phone = word.phones[j];
			let match = lookup.json[phone.phone];
			if (!match) {
				console.log("USING OOV FOR: " + phone.phone);
				match = "OOV";
			}
			if (prev.phone) {
				transcript.phones[prev.phone][transcript.phones[prev.phone].length - 1].next = match;
			}
			transcript.phones[match] = transcript.phones[match] || [];
			const data = {
				start: start,
				end: start + phone.duration,
				dur: phone.duration,
				phone: match,
				prev: prev.phone,
				file: file
			};
			transcript.words[aligned][transcript.words[aligned].length - 1].phones.push(data);
			transcript.phones[match].push(data);
			start += phone.duration;
			prev.phone = match;
		}
	}
	return transcript;
}

function convertMultiple(transcript, json, matchPunctuation) {
	for (let i = 0; i < json.length; i++) {
		const script = convert(json[i].script, json[i].type, json[i].file, matchPunctuation);
		for (let word in script.words) {
			transcript.words[word] = transcript.words[word] || [];
			for (let j = 0; j < script.words[word].length; j++) {
				transcript.words[word].push(script.words[word][j]);
			}
		}
		for (let phone in script.phones) {
			transcript.phones[phone] = transcript.phones[phone] || [];
			for (let k = 0; k < script.phones[phone].length; k++) {
				transcript.phones[phone].push(script.phones[phone][k]);
			}
		}
	}
	return transcript;
}

function convert(data, type, file, matchPunctuation) {
	const transcript = {
		words: {},
		phones: {}
	};
	const lower = type.toLowerCase();
	if (lower === "textgrid") {
		return convertTextGrid(transcript, data, file);
	} else if (lower === "json") {
		const json = JSON.parse(data);
		if (Array.isArray(json)) {
			return convertMultiple(transcript, json, matchPunctuation);
		} else {
			return convertJson(transcript, json, file, matchPunctuation);
		}
	} else {
		return convertSentence(data, matchPunctuation);
	}
	//saveJson(transcript);
	//process(phones);
}

module.exports = convert;