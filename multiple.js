"use strict";

const fs = require("fs");

function multiple(path) {
	const transcripts = [];
	const files = fs.readdirSync(path);
	for (let i = 0; i < files.length; i++) {
		if (files[i].split(".").pop() === "json") {
			const name = files[i].replace(/\.[^/.]+$/, "");
			transcripts.push({ script: JSON.parse(fs.readFileSync(path + "/" + name + ".json")), file: name + ".wav" });
		}
	}
	fs.writeFileSync("complete.json", JSON.stringify(transcripts));
}

multiple("./WEBSITE/rosen");