"use strict";

const convert = (function() {

	function isPunctuation(char) {
		return "!?.".indexOf(char) !== -1;
	}

	function convertSentence(sentence, matchPunctuation) {
		const words = sentence.toLowerCase().match(matchPunctuation ? /\w+(?:'\w+)*|[!?.](?![!?.])/g : /\w+(?:'\w+)*/g);
		const transcript = {
			transcript: sentence,
			words: [],
			phones: []
		};
		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			if (isPunctuation(word)) continue;
			transcript.words.push({
				prev: words[i - 1],
				next: words[i + 1],
				phone: word
			});
			const phones = dictionary[word];
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

	function convertTextGrid(transcript, str, file, matchExact) {
		const lines = str.split("\n");
		let mode = "words";
		let intervals = 0;
		let size = 2;
		let prev;
		while (lines.length > 0) {
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
							const match = matchExact ? text : lookup.textgrid[text];
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

	function convertJson(transcript, json, file, matchPunctuation, matchExact, ignoreWordGaps) {
		const prev = {};
		for (let i = 0; i < json.words.length; i++) {
			const word = json.words[i];
			if (word.case === "not-found-in-audio") continue;
			const aligned = word.word.toLowerCase();
			const char = json.transcript.charAt(word.endOffset);
			if (prev.word) {
				transcript.words[prev.word][transcript.words[prev.word].length - 1].next = matchPunctuation && isPunctuation(char) ? char : aligned;
			}
			transcript.words[aligned] = transcript.words[aligned] || [];
			transcript.words[aligned].push({
				start: word.start,
				end: word.end,
				dur: word.end - word.start,
				phone: aligned,
				prev: matchPunctuation && isPunctuation(char) ? prev.char : prev.word,
				phones: [],
				file: file
			});
			prev.word = aligned;
			prev.char = char;
			if (!ignoreWordGaps) {
				prev.phone = undefined;
			}
			let start = word.start;
			for (let j = 0; j < word.phones.length; j++) {
				const phone = word.phones[j];
				let match = matchExact ? phone.phone : lookup.json[phone.phone];
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

	function convertMultiple(transcript, json, matchPunctuation, matchExact, ignoreWordGaps) {
		for (let i = 0; i < json.length; i++) {
			const script = convert(json[i].script, json[i].type, json[i].file, matchPunctuation, matchExact, ignoreWordGaps);
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

	return function(data, type, file, matchPunctuation, matchExact, ignoreWordGaps) {
		const transcript = {
			words: {},
			phones: {}
		};
		const lower = type.toLowerCase();
		if (lower === "textgrid") {
			return convertTextGrid(transcript, data, file, matchExact);
		} else if (lower === "json") {
			const json = JSON.parse(data);
			if (Array.isArray(json)) {
				return convertMultiple(transcript, json, matchPunctuation, matchExact, ignoreWordGaps);
			} else {
				return convertJson(transcript, json, file, matchPunctuation, matchExact, ignoreWordGaps);
			}
		} else {
			return convertSentence(data, matchPunctuation);
		}
	};

}());