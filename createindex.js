"use strict";

const fs = require("fs");

function createIndex(path) {
	const transcripts = [];
	const files = fs.readdirSync(path);
	for (let i = 0; i < files.length; i++) {
		if (files[i].split(".").pop() === "json") {
			const name = files[i].replace(/\.[^/.]+$/, "");
			transcripts.push({
				audio: "https://mysterypancake.github.io/Phomeme-Rosen/series1/" + name.replace(/ /g, "_") + ".wav",
				name: name.split(" - ")[0],
				transcript: "https://mysterypancake.github.io/Phomeme-Rosen/series1/" + name.replace(/ /g, "_") + ".json",
				video: "https://mysterypancake.github.io/Phomeme-Rosen/series1/" + name.replace(/ /g, "_") + ".mp4"
			});
		}
	}
	fs.writeFileSync("index.json", JSON.stringify(transcripts, undefined, "\t"));
}

createIndex("./PRESETS/rosen/series1");