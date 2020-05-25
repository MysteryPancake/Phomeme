"use strict";

const convert = (function() {

	/*function isPunctuation(char) {
		return "!?.".indexOf(char) !== -1;
	}*/

	function convertSentence(dataParts, params) {
		//const words = dataParts.data.toLowerCase().match(params.matchPunctuation ? /\w+(?:'\w+)*|[!?.](?![!?.])/g : /\w+(?:'\w+)*/g);
		const words = dataParts.data.toLowerCase().match(/\w+(?:'\w+)*/g);
		const prev = {};
		const transcript = {
			transcript: dataParts.data,
			words: [],
			phones: []
		};
		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			//if (isPunctuation(word)) continue;
			const wordData = {
				prev: prev.word,
				label: word
			};
			if (prev.word) {
				prev.word.next = wordData;
			}
			transcript.words.push(wordData);
			if (!params.ignoreWordGaps) {
				prev.phone = undefined;
			}
			const phones = dictionary[word];
			if (phones) {
				wordData.phones = [];
				for (let j = 0; j < phones.length; j++) {
					const phoneData = {
						prev: prev.phone,
						label: phones[j]
					};
					if (prev.phone) {
						prev.phone.next = phoneData;
					}
					wordData.phones.push(phoneData);
					transcript.phones.push(phoneData);
				}
			} else {
				console.log("MISSING DEFINITION: " + word);
			}
		}
		return transcript;
	}

	function convertTextGrid(transcript, dataParts, params) {
		const lines = dataParts.data.split("\n");
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
					} else if (params.matchGeneral) {
						const generalization = lookup.webmaus && lookup.webmaus[text];
						if (generalization !== undefined) {
							text = generalization;
						}
					}
					transcript[mode][text] = transcript[mode][text] || [];
					const data = {
						start: xmin,
						end: xmax,
						dur: xmax - xmin,
						label: text,
						prev: prev,
						file: dataParts.file
					};
					if (prev) {
						prev.next = data;
					}
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
					prev = data;
				}
				if (intervals + 1 === size) {
					mode = "phones";
				}
			}
		}
		return transcript;
	}

	function convertVdat(transcript, dataParts, params) {
		const lines = dataParts.data.split("\n");
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
					transcript.words[word] = transcript.words[word] || [];
					const wordStart = parseFloat(wordParts[2]);
					const wordEnd = parseFloat(wordParts[3]);
					const wordData = {
						start: wordStart,
						end: wordEnd,
						dur: wordEnd - wordStart,
						label: word,
						prev: prev.word,
						phones: [],
						file: dataParts.file
					};
					if (prev.word) {
						prev.word.next = wordData;
					}
					transcript.words[word].push(wordData);
					prev.word = wordData;
					if (!params.ignoreWordGaps) {
						prev.phone = undefined;
					}
					let nextLine = lines.shift();
					while (!nextLine.endsWith("}")) {
						const phoneParts = nextLine.split(" ");
						if (phoneParts.length >= 4) {
							let phone = phoneParts[1].trim();
							if (params.matchGeneral) {
								const generalization = lookup.vdat && lookup.vdat[phone];
								if (generalization !== undefined) {
									phone = generalization;
								}
							}
							transcript.phones[phone] = transcript.phones[phone] || [];
							const phoneStart = parseFloat(phoneParts[2]);
							const phoneEnd = parseFloat(phoneParts[3]);
							const phoneData = {
								start: phoneStart,
								end: phoneEnd,
								dur: phoneEnd - phoneStart,
								label: phone,
								prev: prev.phone,
								file: dataParts.file
							};
							if (prev.phone) {
								prev.phone.next = phoneData;
							}
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

	function convertCues(transcript, dataParts) {
		const points = dataParts.data.listCuePoints();
		let prev;
		for (let i = 0; i < points.length; i++) {
			const pos = points[i].position;
			if (pos === undefined) continue;
			const start = pos / 1000;
			let phone = points[i].label;
			if (phone === undefined) {
				phone = "";
			}
			transcript.phones[phone] = transcript.phones[phone] || [];
			const phoneData = {
				start: start,
				label: phone,
				prev: prev,
				file: dataParts.file
			};
			if (prev) {
				prev.next = phoneData;
				if (!prev.end) {
					prev.end = start;
					prev.dur = prev.end - prev.start;
				}
			}
			const end = points[i].end;
			if (end) {
				phoneData.end = end / 1000;
				phoneData.dur = phoneData.end - phoneData.start;
			}
			transcript.phones[phone].push(phoneData);
			prev = phoneData;
		}
		if (!prev.end) {
			const fileDuration = dataParts.data.data.chunkSize / dataParts.data.fmt.byteRate;
			prev.end = fileDuration;
			prev.dur = prev.end - prev.start;
		}
		return transcript;
	}

	function convertJson(transcript, dataParts, params) {
		const prev = {};
		transcript.transcript = dataParts.data.transcript;
		for (let i = 0; i < dataParts.data.words.length; i++) {
			const wordObj = dataParts.data.words[i];
			if (wordObj.case === "not-found-in-audio") continue;
			const word = wordObj.word.toLowerCase();
			//const char = dataParts.data.transcript.charAt(wordObj.endOffset);
			transcript.words[word] = transcript.words[word] || [];
			const wordData = {
				start: wordObj.start,
				end: wordObj.end,
				dur: wordObj.end - wordObj.start,
				label: word,
				//prev: params.matchPunctuation && isPunctuation(prev.char) ? prev.char : prev.word,
				prev: prev.word,
				phones: [],
				file: dataParts.file
			};
			if (prev.word) {
				//prev.word.next = params.matchPunctuation && isPunctuation(char) ? char : word;
				prev.word.next = wordData;
			}
			transcript.words[word].push(wordData);
			prev.word = wordData;
			//prev.char = char;
			if (!params.ignoreWordGaps) {
				prev.phone = undefined;
			}
			let start = wordObj.start;
			for (let j = 0; j < wordObj.phones.length; j++) {
				const phoneObj = wordObj.phones[j];
				let phone = phoneObj.phone;
				if (params.matchGeneral) {
					const generalization = lookup.gentle && lookup.gentle[phone];
					if (generalization !== undefined) {
						phone = generalization;
					}
				}
				transcript.phones[phone] = transcript.phones[phone] || [];
				const phoneData = {
					start: start,
					end: start + phoneObj.duration,
					dur: phoneObj.duration,
					label: phone,
					prev: prev.phone,
					file: dataParts.file
				};
				if (prev.phone) {
					prev.phone.next = phoneData;
				}
				wordData.phones.push(phoneData);
				transcript.phones[phone].push(phoneData);
				start += phoneObj.duration;
				prev.phone = phoneData;
			}
		}
		return transcript;
	}

	return function(dataParts, params) {
		const transcript = {
			words: {},
			phones: {}
		};
		switch (dataParts.type.toLowerCase()) {
		case "textgrid":
			return convertTextGrid(transcript, dataParts, params);
		case "vdat":
			return convertVdat(transcript, dataParts, params);
		case "cues":
			return convertCues(transcript, dataParts);
		case "json": {
			return convertJson(transcript, dataParts, params);
		}
		default:
			return convertSentence(dataParts, params);
		}
	};

}());