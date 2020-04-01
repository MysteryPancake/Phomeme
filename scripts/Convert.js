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
			const wordData = {
				prev: words[i - 1],
				next: words[i + 1],
				phone: word
			};
			transcript.words.push(wordData);
			const phones = dictionary[word];
			if (phones) {
				wordData.phones = [];
				for (let j = 0; j < phones.length; j++) {
					const phoneData = {
						prev: phones[j - 1],
						next: phones[j + 1],
						phone: phones[j]
					};
					wordData.phones.push(phoneData);
					transcript.phones.push(phoneData);
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
						if (text === "") continue;
						text = text.toLowerCase();
					} else {
						const match = matchExact ? text : lookup.textgrid[text];
						if (match === undefined) {
							console.log("USING OOV FOR: " + text);
							text = "OOV";
						} else {
							text = match;
						}
					}
					if (prev !== undefined) {
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
				if (intervals + 1 === size) {
					mode = "phones";
				}
			}
		}
		return transcript;
	}

	function convertVdat(transcript, str, file, matchExact, ignoreWordGaps) {
		const lines = str.split("\n");
		const prev = {};
		while (lines.length > 0) {
			const line = lines.shift().trim();
			if (line.startsWith("PLAINTEXT")) {
				lines.shift();
				transcript.transcript = lines.shift().trim();
			} else if (line.startsWith("WORD") && line !== "WORDS") {
				const wordParts = line.split(" ");
				if (wordParts.length >= 4) {
					const word = wordParts[1].trim().toLowerCase();
					if (prev.word) {
						prev.word.next = word;
					}
					transcript.words[word] = transcript.words[word] || [];
					const wordStart = parseFloat(wordParts[2]);
					const wordEnd = parseFloat(wordParts[3]);
					const wordData = {
						start: wordStart,
						end: wordEnd,
						dur: wordEnd - wordStart,
						phone: word,
						prev: prev.word && prev.word.phone,
						phones: [],
						file: file
					};
					transcript.words[word].push(wordData);
					prev.word = wordData;
					if (!ignoreWordGaps) {
						prev.phone = undefined;
					}
					let nextLine = lines.shift();
					while (!nextLine.endsWith("}")) {
						const phoneParts = nextLine.split(" ");
						if (phoneParts.length >= 4) {
							let phone = phoneParts[1].trim();
							const match = matchExact ? phone : lookup.vdat[phone];
							if (match === undefined) {
								console.log("USING OOV FOR: " + phone);
								phone = "OOV";
							} else {
								phone = match;
							}
							if (prev.phone) {
								prev.phone.next = phone;
							}
							transcript.phones[phone] = transcript.phones[phone] || [];
							const phoneStart = parseFloat(phoneParts[2]);
							const phoneEnd = parseFloat(phoneParts[3]);
							const phoneData = {
								start: phoneStart,
								end: phoneEnd,
								dur: phoneEnd - phoneStart,
								phone: phone,
								prev: prev.phone && prev.phone.phone,
								file: file
							};
							wordData.phones.push(phoneData);
							transcript.phones[phone].push(phoneData);
							prev.phone = phoneData;
						}
						nextLine = lines.shift();
					}
				}
			}
		}
		return transcript;
	}

	function convertJson(transcript, json, file, matchPunctuation, matchExact, ignoreWordGaps) {
		const prev = {};
		transcript.transcript = json.transcript;
		for (let i = 0; i < json.words.length; i++) {
			const wordObj = json.words[i];
			if (wordObj.case === "not-found-in-audio") continue;
			const word = wordObj.word.toLowerCase();
			const char = json.transcript.charAt(wordObj.endOffset);
			if (prev.word) {
				prev.word.next = matchPunctuation && isPunctuation(char) ? char : word;
			}
			transcript.words[word] = transcript.words[word] || [];
			const wordData = {
				start: wordObj.start,
				end: wordObj.end,
				dur: wordObj.end - wordObj.start,
				phone: word,
				prev: matchPunctuation && isPunctuation(char) ? prev.char : prev.word && prev.word.phone,
				phones: [],
				file: file
			};
			transcript.words[word].push(wordData);
			prev.word = wordData;
			prev.char = char;
			if (!ignoreWordGaps) {
				prev.phone = undefined;
			}
			let start = wordObj.start;
			for (let j = 0; j < wordObj.phones.length; j++) {
				const phoneObj = wordObj.phones[j];
				let phone = matchExact ? phoneObj.phone : lookup.json[phoneObj.phone];
				if (phone === undefined) {
					console.log("USING OOV FOR: " + phoneObj.phone);
					phone = "OOV";
				}
				if (prev.phone) {
					prev.phone.next = phone;
				}
				transcript.phones[phone] = transcript.phones[phone] || [];
				const phoneData = {
					start: start,
					end: start + phoneObj.duration,
					dur: phoneObj.duration,
					phone: phone,
					prev: prev.phone && prev.phone.phone,
					file: file
				};
				wordData.phones.push(phoneData);
				transcript.phones[phone].push(phoneData);
				start += phoneObj.duration;
				prev.phone = phoneData;
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
		switch (type.toLowerCase()) {
		case "textgrid":
			return convertTextGrid(transcript, data, file, matchExact);
		case "vdat":
			return convertVdat(transcript, data, file, matchExact, ignoreWordGaps);
		case "json": {
			const json = JSON.parse(data);
			if (Array.isArray(json)) {
				return convertMultiple(transcript, json, matchPunctuation, matchExact, ignoreWordGaps);
			} else {
				return convertJson(transcript, json, file, matchPunctuation, matchExact, ignoreWordGaps);
			}
		}
		default:
			return convertSentence(data, matchPunctuation);
		}
	};

}());