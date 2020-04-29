"use strict";

const triphone = (function() {

	function choosePhone(method, target, phones) {
		switch (method) {
		case "first":
			return phones[0];
		case "last":
			return phones[phones.length - 1];
		case "random":
			return phones[Math.floor(Math.random() * phones.length)];
		case "duration": {
			let match;
			let difference;
			for (let i = 0; i < phones.length; i++) {
				const diff = Math.abs(target - phones[i].dur);
				if (difference === undefined || diff < difference) {
					difference = diff;
					match = phones[i];
				}
			}
			return match;
		}
		case "longest": {
			let match = phones[0];
			for (let i = 0; i < phones.length; i++) {
				if (phones[i].dur > match.dur) {
					match = phones[i];
				}
			}
			return match;
		}
		case "shortest": {
			let match = phones[0];
			for (let i = 0; i < phones.length; i++) {
				if (phones[i].dur < match.dur) {
					match = phones[i];
				}
			}
			return match;
		}
		case "average": {
			let sum = 0;
			for (let i = 0; i < phones.length; i++) {
				sum += phones[i].dur;
			}
			const average = sum / phones.length;
			return choosePhone("duration", average, phones);
		}
		default:
			return phones[0];
		}
	}

	return function(target, phones, method, matchDiphones, matchTriphones) {
		const diphones = [];
		const triphones = [];
		for (let i = 0; i < phones.length; i++) {
			const matchPrev = phones[i].prev === target.prev;
			const matchNext = phones[i].next === target.next;
			if (matchTriphones && matchPrev && matchNext) {
				triphones.push(phones[i]);
				//console.log("MATCHED TRIPHONE: " + target.prev + " " + target.label + " " + target.next);
			} else if (matchDiphones && matchPrev) {
				diphones.push(phones[i]);
				//console.log("MATCHED DIPHONE: " + target.prev + " " + target.label);
			} else if (matchDiphones && matchNext) {
				diphones.push(phones[i]);
				//console.log("MATCHED DIPHONE: " + target.label + " " + target.next);
			}
		}
		if (triphones.length) {
			return choosePhone(method, target.dur, triphones);
		} else if (diphones.length) {
			return choosePhone(method, target.dur, diphones);
		} else {
			return choosePhone(method, target.dur, phones);
		}
	};

}());