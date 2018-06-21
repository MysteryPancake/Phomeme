"use strict";

function choosePhone(method, target, phones) {
	if (method === "first") {
		return phones[0];
	} else if (method === "last") {
		return phones[phones.length - 1];
	} else if (method === "random") {
		return phones[Math.floor(Math.random() * phones.length)];
	} else if (method === "duration") {
		var match, distance;
		for (var i = 0; i < phones.length; i++) {
			var difference = Math.abs(target.dur - phones[i].dur);
			if (distance === undefined || difference < distance) {
				distance = difference;
				match = phones[i];
			}
		}
		return match;
	} else {
		return phones[0];
	}
}

function triphone(target, phones, method, matchDiphones, matchTriphones) {
	var matching = 0;
	var diphones = [];
	var triphones = [];
	for (var i = 0; i < phones.length; i++) {
		var matchPrev = phones[i].prev === target.prev;
		var matchNext = phones[i].next === target.next;
		if (matchTriphones && matchPrev && matchNext && matching <= 2) {
			matching = 2;
			triphones.push(phones[i]);
			console.log("MATCHED TRIPHONE: " + target.prev + " " + target.phone + " " + target.next);
		} else if (matchDiphones && matchPrev && matching <= 1) {
			matching = 1;
			diphones.push(phones[i]);
			console.log("MATCHED DIPHONE: " + target.prev + " " + target.phone);
		} else if (matchDiphones && matchNext && matching <= 1) {
			matching = 1;
			diphones.push(phones[i]);
			console.log("MATCHED DIPHONE: " + target.phone + " " + target.next);
		}
	}
	if (triphones.length > 0) {
		return choosePhone(method, target, triphones);
	} else if (diphones.length > 0) {
		return choosePhone(method, target, diphones);
	} else {
		return choosePhone(method, target, phones);
	}
}