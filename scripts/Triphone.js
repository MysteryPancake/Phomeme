"use strict";

function choosePhone(method, target, phones) {
	if (method === "first") {
		return phones[0];
	} else if (method === "last") {
		return phones[phones.length - 1];
	} else if (method === "random") {
		return phones[Math.floor(Math.random() * phones.length)];
	} else if (method === "duration") {
		var difference;
		var match;
		for (var i = 0; i < phones.length; i++) {
			var diff = Math.abs(target - phones[i].dur);
			if (difference === undefined || diff < difference) {
				difference = diff;
				match = phones[i];
			}
		}
		return match;
	} else if (method === "longest") {
		var match = phones[0];
		for (var i = 0; i < phones.length; i++) {
			if (phones[i].dur > match.dur) {
				match = phones[i];
			}
		}
		return match;
	} else if (method === "shortest") {
		var match = phones[0];
		for (var i = 0; i < phones.length; i++) {
			if (phones[i].dur < match.dur) {
				match = phones[i];
			}
		}
		return match;
	} else if (method === "average") {
		var sum = 0;
		for (var i = 0; i < phones.length; i++) {
			sum += phones[i].dur;
		}
		var average = sum / phones.length;
		return choosePhone("duration", average, phones);
	} else {
		return phones[0];
	}
}

function triphone(target, phones, method, matchDiphones, matchTriphones) {
	var diphones = [];
	var triphones = [];
	for (var i = 0; i < phones.length; i++) {
		var matchPrev = phones[i].prev === target.prev;
		var matchNext = phones[i].next === target.next;
		if (matchTriphones && matchPrev && matchNext) {
			triphones.push(phones[i]);
			//console.log("MATCHED TRIPHONE: " + target.prev + " " + target.phone + " " + target.next);
		} else if (matchDiphones && matchPrev) {
			diphones.push(phones[i]);
			//console.log("MATCHED DIPHONE: " + target.prev + " " + target.phone);
		} else if (matchDiphones && matchNext) {
			diphones.push(phones[i]);
			//console.log("MATCHED DIPHONE: " + target.phone + " " + target.next);
		}
	}
	if (triphones.length) {
		return choosePhone(method, target.dur, triphones);
	} else if (diphones.length) {
		return choosePhone(method, target.dur, diphones);
	} else {
		return choosePhone(method, target.dur, phones);
	}
}