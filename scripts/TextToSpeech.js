"use strict";

const textToSpeech = (function() {

	function addClips(targets, phones, mix, params, length, func) {
		for (let i = 0; i < targets.length; i++) {
			const target = targets[i];
			const words = phones.get(target.label);
			if (words) {
				// For now, choose first candidate (editor should allow multiple choices)
				const match = triphone(words, target, params)[0];
				mix.addClip(match.file, target.label, length - params.overlapStart, length + match.dur + params.overlapEnd, match.start - params.overlapStart, match.end + params.overlapEnd, 1, 0, 1);
				length += match.dur;
			} else {
				length = func(target, length) || length;
			}
		}
		return length;
	}

	return function(source, destination, params) {
		// Convert input and output to intermediate format
		const input = convert(source, params);
		const output = convert(destination, params);
		const mix = new AuditionSession("session", 32, params.sampleRate);
		if (params.matchWords && input.words && output.words) {
			// Attempt word level alignment
			addClips(output.words, input.words, mix, params, 0, function(target, length) {
				console.log(`USING PHONES FOR: ${target.label}`);
				if (target.phones) {
					// Fallback to phoneme level alignment if word is absent from input
					return addClips(target.phones, input.phones, mix, params, length, function(data) {
						// Move on if no words or phonemes match
						console.log(`MISSING PHONE: ${data.label}`);
					});
				} else {
					// Move on if no phonemes are available
					console.log(`MISSING DEFINITION: ${target.label}`);
				}
			});
		} else {
			// Attempt phoneme level alignment
			addClips(output.phones, input.phones, mix, params, 0, function(target) {
				// Move on if no phonemes match
				console.log(`MISSING PHONE: ${target.label}`);
			});
		}
		return mix.compile();
	};

}());