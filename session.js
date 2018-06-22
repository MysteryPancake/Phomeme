"use strict";

const fs = require("fs");

function xmlSafe(str) {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/"/g, "&apos;");
}

module.exports = function(name, bitDepth, sampleRate) {
	this.name = name || "Untitled Session";
	this.depth = bitDepth || 16;
	this.rate = sampleRate || 16000;
	this.before = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<!DOCTYPE sesx>
<sesx version="1.1">
	<session appBuild="8.0.0.192" appVersion="8.0" audioChannelType="stereo" bitDepth="${this.depth}" sampleRate="${this.rate}">
		<name>${this.name}.sesx</name>
		<tracks>
			<audioTrack automationLaneOpenState="false" id="10001" index="1" select="false" visible="true">
				<trackParameters trackHeight="134" trackHue="-1" trackMinimized="false">
					<name>Phomeme</name>
				</trackParameters>
				<trackAudioParameters audioChannelType="stereo" automationMode="1" monitoring="false" recordArmed="false" solo="false" soloSafe="false">
					<trackOutput outputID="10000" type="trackID"/>
					<trackInput inputID="1"/>
				</trackAudioParameters>\n`;
	this.middle = `\t\t\t</audioTrack>
		</tracks>
	</session>
	<files>\n`;
	this.after = `\t</files>
</sesx>`;
	this.overlapStart = 0;
	this.overlapEnd = 0;
	this.files = [];
	this.addFile = function(path) {
		return this.files.push({
			xml: `\t\t<file id="${this.files.length}" importerPrivateSettings="Compression:0:0;LargeFileSupport:0:0;SampleType:0:40;" mediaHandler="AmioWav" relativePath="${path}"/>\n`,
			path: path
		});
	};
	this.clips = [];
	this.addClip = function(path, phone, start, end, sourceStart, sourceEnd, stretch) {
		let id;
		for (let i = 0; i < this.files.length; i++) {
			if (this.files[i].path === path) {
				id = i;
			}
		}
		if (id === undefined) {
			id = this.addFile(path) - 1;
		}
		this.clips.push(`\t\t\t\t<audioClip clipAutoCrossfade="true" crossFadeHeadClipID="-1" crossFadeTailClipID="-1" endPoint="${(end + this.overlapEnd) * this.rate}" fileID="${id}" hue="-1" id="${this.clips.length}" lockedInTime="false" looped="false" name="${xmlSafe(phone)}" offline="false" select="false" sourceInPoint="${(sourceStart - this.overlapStart) * this.rate}" sourceOutPoint="${(sourceEnd + this.overlapEnd) * this.rate}" startPoint="${(start - this.overlapStart) * this.rate}" zOrder="${this.clips.length}">
			\t\t<clipStretch adaptiveWindowSize="37" pitchAdjustment="0" preserveFormants="true" stretchMode="rendered" stretchQuality="high" stretchRatio="${stretch}" stretchType="solo" transientSensitivity="40"/>
		\t\t</audioClip>\n`);
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
	this.save = function() {
		fs.writeFileSync(this.name + ".sesx", this.compile());
	};
};