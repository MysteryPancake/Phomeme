"use strict";

const textToSpeech = (function() {

	function addClips(targets, phones, mix, method, diphones, triphones, length, func) {
		for (let i = 0; i < targets.length; i++) {
			const target = targets[i];
			const words = phones[target.label];
			if (words) {
				const match = triphone(target, words, method, diphones, triphones);
				mix.addClip(match.file, target.label, length, length + match.dur, match.start, match.end, 1);
				length += match.dur;
			} else {
				length = func(target, length) || length;
			}
		}
		return length;
	}

	return function(source, destination, chooseMethod, matchWords, matchDiphones, matchTriphones, matchPunctuation, matchExact, ignoreWordGaps, overlapStart, overlapEnd, sampleRate) {
		const input = convert(source.data, source.type, "input.wav", matchPunctuation, matchExact, ignoreWordGaps);
		const output = convert(destination.data, destination.type, "input.wav", matchPunctuation, matchExact, ignoreWordGaps);
		const mix = new AuditionSession("session", 32, sampleRate);
		mix.overlapStart = overlapStart;
		mix.overlapEnd = overlapEnd;
		if (matchWords && input.words && output.words) {
			addClips(output.words, input.words, mix, chooseMethod, matchDiphones, matchTriphones, 0, function(target, length) {
				console.log("USING PHONES FOR: " + target.label);
				if (target.phones) {
					return addClips(target.phones, input.phones, mix, chooseMethod, matchDiphones, matchTriphones, length, function(data) {
						console.log("MISSING PHONE: " + data.label);
					});
				} else {
					console.log("MISSING DEFINITION: " + target.label);
				}
			});
		} else {
			addClips(output.phones, input.phones, mix, chooseMethod, matchDiphones, matchTriphones, 0, function(target) {
				console.log("MISSING PHONE: " + target.label);
			});
		}
		return mix.compile();
	};
	
}());