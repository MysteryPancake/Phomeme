"use strict";

const AuditionSession = (function() {

	function xmlSafe(str) {
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
	}

	return function(name = "Untitled Session", bitDepth = 16, sampleRate = 44100) {
		this.name = name;
		this.depth = bitDepth;
		this.rate = sampleRate;
		this.before = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n<!DOCTYPE sesx>\n<sesx version="1.1">\n\t<session appBuild="8.0.0.192" appVersion="8.0" audioChannelType="stereo" bitDepth="${this.depth}" sampleRate="${this.rate}">\n\t\t<name>${this.name}.sesx</name>\n\t\t<tracks>\n\t\t\t<audioTrack automationLaneOpenState="false" id="10001" index="1" select="false" visible="true">\n\t\t\t\t<trackParameters trackHeight="134" trackHue="-1" trackMinimized="false">\n\t\t\t\t\t<name>Phomeme</name>\n\t\t\t\t</trackParameters>\n\t\t\t\t<trackAudioParameters audioChannelType="stereo" automationMode="1" monitoring="false" recordArmed="false" solo="false" soloSafe="false">\n\t\t\t\t\t<trackOutput outputID="10000" type="trackID"/>\n\t\t\t\t\t<trackInput inputID="1"/>\n\t\t\t\t</trackAudioParameters>\n`;
		this.middle = "\t\t\t</audioTrack>\n\t\t</tracks>\n\t</session>\n\t<files>\n";
		this.after = "\t</files>\n</sesx>";
		this.files = [];
		this.addFile = function(path) {
			return this.files.push({
				xml: `\t\t<file id="${this.files.length}" relativePath="${path}"/>\n`,
				path: path
			});
		};
		this.clips = [];
		this.addClip = function(path, label, start, end, sourceStart, sourceEnd, stretch = 1, pitchOffset = 0, volume = 1) {
			let id;
			for (let i = 0; i < this.files.length; i++) {
				if (this.files[i].path === path) {
					id = i;
				}
			}
			if (id === undefined) {
				id = this.addFile(path) - 1;
			}
			this.clips.push(`\t\t\t\t<audioClip clipAutoCrossfade="true" crossFadeHeadClipID="-1" crossFadeTailClipID="-1" endPoint="${(end * this.rate)}" fileID="${id}" hue="-1" id="${this.clips.length}" lockedInTime="false" looped="false" name="${xmlSafe(label)}" offline="false" select="false" sourceInPoint="${sourceStart * this.rate}" sourceOutPoint="${sourceEnd * this.rate}" startPoint="${start * this.rate}" zOrder="${this.clips.length}">\n\t\t\t\t\t<component componentID="Audition.Fader" id="clipGain" name="volume" powered="true">\n\t\t\t\t\t\t<parameter index="0" name="volume" parameterValue="1"/>\n\t\t\t\t\t\t<parameter index="1" name="static gain" parameterValue="${volume}"/>\n\t\t\t\t\t</component>\n\t\t\t\t\t<clipStretch pitchAdjustment="${pitchOffset}" preserveFormants="true" stretchMode="rendered" stretchQuality="high" stretchRatio="${stretch}" stretchType="solo"/>\n\t\t\t\t</audioClip>\n`);
		};
		this.compile = function() {
			let result = this.before;
			for (let i = 0; i < this.clips.length; i++) {
				result += this.clips[i];
			}
			result += this.middle;
			for (let j = 0; j < this.files.length; j++) {
				result += this.files[j].xml;
			}
			result += this.after;
			return result;
		};
	};
	
}());