"use strict";

const fs = require("fs");
const convert = require("./convert.js");

function multiple(path) {
	const words = {};
	const phones = {};
	const files = fs.readdirSync(path);
	for (let i = 0; i < files.length; i++) {
		const name = files[i].replace(/\.[^/.]+$/, "");
		if (files[i].split(".").pop() === "json") {
			const script = convert(JSON.parse(fs.readFileSync(path + "/" + name + ".json")), name + ".wav");
			for (let word in script.words) {
				words[word] = words[word] || [];
				for (let j = 0; j < script.words[word].length; j++) {
					words[word].push(script.words[word][j]);
				}
			}
			for (let phone in script.phones) {
				phones[phone] = phones[phone] || [];
				for (let k = 0; k < script.phones[phone].length; k++) {
					phones[phone].push(script.phones[phone][k]);
				}
			}
		}
	}
	fs.writeFileSync("complete.json", JSON.stringify({
		transcript: "<Multiple Transcripts>",
		words: words,
		phones: phones
	}));
}

multiple("./WEBSITE/rosen");