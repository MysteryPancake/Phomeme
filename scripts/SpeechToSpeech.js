"use strict";

const speechToSpeech = (function() {

	function addClip(target, phones, mix, params, func) {
		if (phones) {
			// For now, choose first candidate (editor should allow multiple choices)
			const match = triphone(phones, target, params)[0];
			let stretch = 1;
			if (params.transferDuration) {
				stretch = Math.min(8, target.dur / match.dur);
			}
			let startOverlap = params.overlapStart;
			let endOverlap = params.overlapEnd;
			if (startOverlap + endOverlap > match.dur * stretch) {
				startOverlap = 0;
				endOverlap = 0;
			}
			let pitchOffset = 0;
			if (params.transferPitch && target.pitch !== undefined && match.pitch !== undefined) {
				pitchOffset = target.pitch - match.pitch;
			}
			let volume = 1;
			if (params.transferVolume && target.volume !== undefined && match.volume !== undefined) {
				volume += target.volume - match.volume;
			}
			mix.addClip(match.file, target.label, target.start - startOverlap, target.end + endOverlap, (match.start * stretch) - startOverlap, (match.end * stretch) + endOverlap, stretch, pitchOffset, volume);
		} else {
			func(target);
		}
	}

	return function(source, destination, params) {
		// Convert input and output to intermediate format
		const input = convert(source, params);
		const output = convert(destination, params);
		const mix = new AuditionSession("session", 32, params.sampleRate);
		if (params.matchWords && input.words && output.words) {
			// Attempt word level alignment
			output.words.forEach((word, label) => {
				for (let i = 0; i < word.length; i++) {
					addClip(word[i], input.words.get(label), mix, params, function(target) {
						// Fallback to phoneme level alignment if word is absent from input
						console.log(`USING PHONES FOR: ${target.label}`);
						for (let j = 0; j < target.phones.length; j++) {
							const data = target.phones[j];
							addClip(data, input.phones[data.label], mix, params, function(phone) {
								// Move on if no words or phonemes match
								console.log(`MISSING PHONE: ${phone.label}`);
							});
						}
					});
				}
			});
		} else {
			// Attempt phoneme level alignment
			output.phones.forEach((phone, label) => {
				for (let j = 0; j < phone.length; j++) {
					addClip(phone[j], input.phones.get(label), mix, params, function(target) {
						// Temporary code for testing pitch matching mode
						//if (target.pitch === undefined) {
							// Move on if no phonemes match
							console.log(`MISSING PHONE: ${target.label}`);
						/*} else {
							// For now, assume MIDI pitch matching mode (temporary)
							// This code is garbage, make a better solution
							const availablePitches = Object.keys(input.phones);
							let smallestDiff;
							let closestPitch;
							let closestPitch2;
							for (let k = 0; k < availablePitches.length; k++) {
								const approximatePitch = availablePitches[k];
								const diff = Math.abs(target.pitch - parseInt(approximatePitch));
								if (smallestDiff === undefined || diff < smallestDiff) {
									smallestDiff = diff;
									closestPitch = approximatePitch;
									closestPitch2 = undefined;
								} else if (diff === smallestDiff) {
									closestPitch2 = approximatePitch;
								}
							}
							// Two candidates can have the same difference
							let joinedArray = input.phones[closestPitch];
							if (closestPitch2) {
								joinedArray = joinedArray.concat(input.phones[closestPitch2]);
							}
							console.log(`USING ALTERNATIVE FOR: ${target.label} (${smallestDiff} SEMITONE DIFFERENCE)`);
							addClip(phone[j], joinedArray, mix, params, function(target) {
								console.log("MISSING ALTERNATIVES!");
							});
						}*/
					});
				}
			});
		}
		return mix.compile();
	};

}());