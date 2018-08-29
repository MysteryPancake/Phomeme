"use strict";

function choose(method, target, phones) {
	if (method === "first") {
		return phones[0];
	} else if (method === "last") {
		return phones[phones.length - 1];
	} else if (method === "random") {
		return phones[Math.floor(Math.random() * phones.length)];
	} else if (method === "duration") {
		let match, difference;
		for (let i = 0; i < phones.length; i++) {
			const diff = Math.abs(target - phones[i].dur);
			if (difference === undefined || diff < difference) {
				difference = diff;
				match = phones[i];
			}
		}
		return match;
	} else if (method === "longest") {
		let match = phones[0];
		for (let i = 0; i < phones.length; i++) {
			if (phones[i].dur > match.dur) {
				match = phones[i];
			}
		}
		return match;
	} else if (method === "shortest") {
		let match = phones[0];
		for (let i = 0; i < phones.length; i++) {
			if (phones[i].dur < match.dur) {
				match = phones[i];
			}
		}
		return match;
	} else if (method === "average") {
		let sum = 0;
		for (let i = 0; i < phones.length; i++) {
			sum += phones[i].dur;
		}
		const average = sum / phones.length;
		return choose("duration", average, phones);
	} else {
		return phones[0];
	}
}

module.exports = function(target, phones, method, matchDiphones, matchTriphones) {
	const diphones = [];
	const triphones = [];
	for (let i = 0; i < phones.length; i++) {
		const matchPrev = phones[i].prev === target.prev;
		const matchNext = phones[i].next === target.next;
		if (matchTriphones && matchPrev && matchNext) {
			triphones.push(phones[i]);
			console.log("MATCHED TRIPHONE: " + target.prev + " " + target.phone + " " + target.next);
		} else if (matchDiphones && matchPrev) {
			diphones.push(phones[i]);
			console.log("MATCHED DIPHONE: " + target.prev + " " + target.phone);
		} else if (matchDiphones && matchNext) {
			diphones.push(phones[i]);
			console.log("MATCHED DIPHONE: " + target.phone + " " + target.next);
		}
	}
	if (triphones.length) {
		return choose(method, target.dur, triphones);
	} else if (diphones.length) {
		return choose(method, target.dur, diphones);
	} else {
		return choose(method, target.dur, phones);
	}
};