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

function convert(json, file, matchPunctuation) {
	const transcript = {
		words: {},
		phones: {}
	};
	if (Array.isArray(json)) {
		for (let i = 0; i < json.length; i++) {
			const script = convert(json[i].script, json[i].file);
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
	} else {
		let prev = {};
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
				const simple = phone.phone.split("_").shift().toUpperCase();
				if (prev.phone) {
					transcript.phones[prev.phone][transcript.phones[prev.phone].length - 1].next = simple;
				}
				transcript.phones[simple] = transcript.phones[simple] || [];
				const data = {
					start: start,
					end: start + phone.duration,
					dur: phone.duration,
					phone: simple,
					prev: prev.phone,
					file: file
				};
				transcript.words[aligned][transcript.words[aligned].length - 1].phones.push(data);
				transcript.phones[simple].push(data);
				start += phone.duration;
				prev.phone = simple;
			}
		}
	}
	//saveJson(transcript);
	//process(phones);
	return transcript;
}

module.exports = convert;