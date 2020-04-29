"use strict";

const fs = require("fs");
/*const convert = require("./convert.js");

function crossLookup() {
	const lookup = {};
	const converted1 = convert(fs.readFileSync("SOURCE/TextGridExamples/input.json", "utf8"), "json", "input.wav", false);
	const converted2 = convert(fs.readFileSync("SOURCE/TextGridExamples/input.TextGrid", "utf8"), "TextGrid", "input.wav", false);
	for (let word in converted1.words) {
		const word1 = converted1.words[word];
		const word2 = converted2.words[word];
		if (word1 && word2) {
			for (let i = 0; i < word1.length; i++) {
				const phone1 = word1[i];
				const phone2 = word2[i];
				if (phone1 && phone2) {
					if (phone1.phones.length === phone2.phones.length) {
						for (let j = 0; j < phone1.phones.length; j++) {
							const data1 = phone1.phones[j];
							const data2 = phone2.phones[j];
							if (data1 && data2) {
								lookup[data2.label] = lookup[data2.label] || {};
								lookup[data2.label][data1.label] = lookup[data2.label][data1.label] || 1;
								lookup[data2.label][data1.label]++;
							}
						}
					}
				}
			}
		}
	}
	const result = {};
	for (let data in lookup) {
		let final;
		let total = 0;
		let largest = 0;
		for (let symbol in lookup[data]) {
			const count = lookup[data][symbol];
			largest = Math.max(largest, count);
			if (count >= largest) {
				final = symbol;
			}
			total += count;
		}
		console.log(data + " " + final);
		result[data] = { phone: final, accuracy: Math.floor(largest / total * 100) + "%", alternatives: lookup[data] };
	}
	return result;
}*/

function generateLookup() {
	const result = {};
	const categories = ["gentle", "vdat", "webmaus"];
	for (let i = 0; i < categories.length; i++) {
		const name = categories[i];
		result[name] = {};
		const lookup = fs.readFileSync("lookup" + name + ".txt", "utf8");
		const lines = lookup.split("\n");
		for (let j = 0; j < lines.length; j++) {
			const delimit = lines[j].split(" ");
			result[name][delimit[0]] = delimit[1];
		}
	}
	return JSON.stringify(result, undefined, "\t");
}

//fs.writeFileSync("lookup.json", generateLookup());
console.log(generateLookup());