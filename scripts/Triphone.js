"use strict";

const triphone = (function() {

	const normalizedSortMethod = {
		first: function(a, b, max) {
			return (a.start - b.start) / max.start;
		},
		last: function(a, b, max) {
			return (b.start - a.start) / max.start;
		},
		duration: function(a, b, max, target) {
			return (Math.abs(target.dur - a.dur) - Math.abs(target.dur - b.dur)) / max.diff;
		},
		shortest: function(a, b, max) {
			return (a.dur - b.dur) / max.dur;
		},
		longest: function(a, b, max) {
			return (b.dur - a.dur) / max.dur;
		}
	};

	function normalizedSequenceTotal(a, b, prop, max) {
		return max[prop] === 0 ? 0 : (b[prop] - a[prop]) / max[prop];
	}

	function sequenceTotal(direction, phone, target) {
		let seqTotal = 0;
		let sourcePhone = phone[direction];
		let targetPhone = target[direction];
		if (sourcePhone === undefined && targetPhone === undefined) {
			seqTotal++;
		} else {
			while (sourcePhone && targetPhone && sourcePhone.label === targetPhone.label) {
				seqTotal++;
				sourcePhone = sourcePhone[direction];
				targetPhone = targetPhone[direction];
				if (sourcePhone === undefined && targetPhone === undefined) {
					seqTotal++;
					break;
				}
			}
		}
		return seqTotal;
	}

	function updateMax(prop, phone, max) {
		if (max[prop] === undefined || phone[prop] > max[prop]) {
			max[prop] = phone[prop];
		}
	}

	function calculateMaxes(phone, target, params, max) {
		phone.prevTotal = sequenceTotal("prev", phone, target);
		updateMax("prevTotal", phone, max);
		phone.nextTotal = sequenceTotal("next", phone, target);
		updateMax("nextTotal", phone, max);
		switch (params.method) {
		case "first":
		case "last":
			updateMax("start", phone, max);
			break;
		case "duration": {
			const diff = Math.abs(target.dur - phone.dur);
			if (max.diff === undefined || diff > max.diff) {
				max.diff = diff;
			}
			break;
		}
		case "shortest":
		case "longest":
			updateMax("dur", phone, max);
			break;
		}
	}

	return function(phones, target, params) {
		const diphones = [];
		const triphones = [];
		const max = { prevTotal: 0, nextTotal: 0 };
		for (let i = 0; i < phones.length; i++) {
			const phone = phones[i];
			calculateMaxes(phone, target, params, max);
			const backwardMatch = params.matchOneBackward && phone.prevTotal > 0;
			const forwardMatch = params.matchOneForward && phone.nextTotal > 0;
			if (backwardMatch && forwardMatch) {
				triphones.push(phone);
			} else if (backwardMatch || forwardMatch) {
				diphones.push(phone);
			}
		}
		let finalPhones = phones;
		if (triphones.length > 0) {
			finalPhones = triphones;
		} else if (diphones.length > 0) {
			finalPhones = diphones;
		}
		finalPhones.sort(function(a, b) {
			const method = normalizedSortMethod[params.method](a, b, max, target);
			const prev = normalizedSequenceTotal(a, b, "prevTotal", max);
			const next = normalizedSequenceTotal(a, b, "nextTotal", max);
			return (method * params.methodWeight) + (prev * params.backwardWeight) + (next * params.forwardWeight);
		});
		return finalPhones[0];
	};

}());