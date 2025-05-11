export const submissionType = "Resume";
const filenameStart = "Shield-" + submissionType;
const expectedTitle = "SHIELD";
export const expectedQuestions = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
export const totalQuestions = expectedQuestions.length;

function show(id, message, color = "black") {
  if (typeof document === 'object') {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = message;
      el.style.color = color;
    }
}
}

export function checkFile(filename, content) {
  const lines = content.split("\n");
  const data = {};


  if (!filename.startsWith(filenameStart) || !filename.endsWith(".txt")) {
    show("status", "ERROR: Bad filename", "red");
    return;
  }

  if (filename === filenameStart + "-template.txt") {
    show("status", "ERROR: You must rename the template file", "red");
    return;
  }


  if (lines[0].trim() !== expectedTitle) {
    show("status", "ERROR: First line must be SHIELD", "red");
    return;
  }

  let nameLine = lines[1] || "";
  let idLine = lines[2] || "";

  if (!nameLine.startsWith("Name:") || !idLine.startsWith("SHIELD ID:")) {
    show("status", "ERROR: Name or ID is missing", "red");
    return;
  }

  data.name = nameLine.replace("Name:", "").trim();
  data.ShieldID = idLine.replace("SHIELD ID:", "").trim();

  show("name", data.name);
  show("ShieldID", data.ShieldID);
  show("filename", filename);


  const answers = {};
  let currentQ = null;

  for (let i = 4; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line.includes(".")) {
      let parts = line.split(".");
      let q = parts[0];
      let answer = parts.slice(1).join(".").trim();
      answers[q] = answer;
      currentQ = q;
    } else if (currentQ) {
      answers[currentQ] += "\n" + line;
    }
  }

  const found = Object.keys(answers).join(",");
  const expected = expectedQuestions.join(",");

  if (found !== expected) {
    show("status", "ERROR: Missing Questions. Expected following # of questions: " + totalQuestions, "red");
    return;
  }

  for (let q of expectedQuestions) {
    data[q] = answers[q];
  }

  show("status", "PASSED " + filename + ": " + data.name + " (" + data.ShieldID + ")", "green");
  data.filename = filename;
  data.filecontents = content;
  return data;
}
