"use strict";

const fs = require("fs");
const wav = require("wav-decoder");

function autoCorrelate(buffer, sampleRate) {
	let size = buffer.length;
	let rms = 0;
	for (let i = 0; i < size; i++) {
		const val = buffer[i];
		rms += val * val;
	}
	rms = Math.sqrt(rms / size);
	if (rms < 0.01) {
		return -1;
	}
	let r1 = 0;
	let r2 = size - 1;
	const thres = 0.2;
	for (let i = 0; i < size / 2; i++) {
		if (Math.abs(buffer[i]) < thres) {
			r1 = i;
			break;
		}
	}
	for (let i = 1; i < size / 2; i++) {
		if (Math.abs(buffer[size - i]) < thres) {
			r2 = size - i;
			break;
		}
	}
	buffer = buffer.slice(r1, r2);
	size = buffer.length;
	const c = new Array(size).fill(0);
	for (let i = 0; i < size; i++) {
		for (let j = 0; j < size - i; j++) {
			c[i] += buffer[j] * buffer[j + i];
		}
	}
	let d = 0;
	while (c[d] > c[d + 1]) {
		d++;
	}
	let maxval = -1;
	let maxpos = -1;
	for (let i = d; i < size; i++) {
		if (c[i] > maxval) {
			maxval = c[i];
			maxpos = i;
		}
	}
	let T0 = maxpos;
	const x1 = c[T0 - 1];
	const x2 = c[T0];
	const x3 = c[T0 + 1];
	const a = (x1 + x3 - 2 * x2) / 2;
	const b = (x3 - x1) / 2;
	if (a) {
		T0 -= b / (2 * a);
	}
	return sampleRate / T0;
}

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFromPitch(frequency) {
	return Math.round(12 * Math.log2(frequency / 440)) + 69;
}

const sampleSize = 1024;

function pitch(file) {
	const transcript = {
		transcript: "<Music>",
		words: []
	};
	wav.decode(fs.readFileSync(file + ".wav")).then(function(wave) {
		const buffer = wave.channelData[0];
		const sampleRate = wave.sampleRate;
		let prev;
		for (let i = 0; i < buffer.length / sampleSize; i++) {
			const section = buffer.slice(i * sampleSize, (i + 1) * sampleSize);
			const result = noteFromPitch(autoCorrelate(section, sampleRate));
			const note = noteStrings[result % 12];
			if (result < prev + 1 && result > prev - 1) {
				const word = transcript.words[transcript.words.length - 1];
				const last = word.phones[word.phones.length - 1];
				if (last.phone === note) {
					last.duration += sampleSize / sampleRate;
				} else {
					word.phones.push({
						duration: sampleSize / sampleRate,
						phone: note
					});
				}
				word.end += sampleSize / sampleRate;
			} else {
				transcript.words.push({
					case: isNaN(result) ? "not-found-in-audio" : "success",
					end: ((i + 1) * sampleSize) / sampleRate,
					phones: [{ duration: sampleSize / sampleRate, phone: note }],
					start: (i * sampleSize) / sampleRate,
					alignedWord: result.toString(),
					word: result.toString()
				});
			}
			prev = result;
		}
		fs.writeFileSync(file + ".json", JSON.stringify(transcript, undefined, "\t"));
	});
}

pitch("inputmusic");
pitch("outputmusic");