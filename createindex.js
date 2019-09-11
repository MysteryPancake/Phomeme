"use strict";

const fs = require("fs");

function multiple(path) {
	const transcripts = [];
	const files = fs.readdirSync(path);
	for (let i = 0; i < files.length; i++) {
		if (files[i].split(".").pop() === "json") {
			const name = files[i].replace(/\.[^/.]+$/, "");
			transcripts.push({
				audio: path.split("/").pop() + "/" + name + ".wav",
				name: name,
				transcript: path.split("/").pop() + "/" + name + ".json",
				video: path.split("/").pop() + "/" + name + ".mp4"
			});
		}
	}
	fs.writeFileSync("index.json", JSON.stringify(transcripts, undefined, "\t"));
}

multiple("./WEBSITE/rosen");