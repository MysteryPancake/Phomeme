"use strict";

const fs = require("fs");

function multiple(path) {
	const transcripts = [];
	const files = fs.readdirSync(path);
	for (let i = 0; i < files.length; i++) {
		if (files[i].split(".").pop() === "json") {
			const name = files[i].replace(/\.[^/.]+$/, "");
			transcripts.push({
				transcript: fs.readFileSync(path + "/" + name + ".json", "utf8"),
				file: name + ".wav",
				type: "json"
			});
		}
	}
	fs.writeFileSync("complete.json", JSON.stringify(transcripts, undefined, "\t"));
}

multiple("./WEBSITE/rosen");