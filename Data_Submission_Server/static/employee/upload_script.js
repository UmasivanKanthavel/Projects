import {
  expectedQuestions,
  checkFile        
} from "/FileValidation.js";

let analysisBox;

export function hideAnalysis() {
  analysisBox = document.getElementById("analysis");
  analysisBox.hidden = true;
}

export function uploadSubmission() {
  const fileInput = document.getElementById("assignmentFile");
  processFile(fileInput, true);
}

function processFile(input, shouldUpload) {
  analysisBox.hidden = false;
  const file = input.files[0];

  if (!file) {
    displayMessage("status", "No file selected.", "red");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const contents = event.target.result;
    const name = file.name;
    const parsed = parseAndDisplay(name, contents);
    if (shouldUpload && parsed) {
      sendToServer(name, contents);
    }
  };

  reader.onerror = () => {
    displayMessage("status", "Could not read the file.", "red");
  };

  reader.readAsText(file);
}

function parseAndDisplay(filename, content) {
  const result = checkFile(filename, content);
  if (!result) return null;

  document.getElementById("filename").textContent = filename;
  document.getElementById("ShieldID").textContent = result.ShieldID || "";
  document.getElementById("name").textContent = result.name || "";

  const list = Array.isArray(expectedQuestions) ? expectedQuestions : expectedQuestions.split(",");;
  const container = document.getElementById("questions");
  container.innerHTML = "";

  for (let q of list) {
    const outer = document.createElement("div");
    const label = document.createElement("strong");
    label.textContent = `Q${q}: `;

    const answer = document.createElement("span");
    answer.textContent = result[q] || "(empty)";

    outer.appendChild(label);
    outer.appendChild(answer);
    container.appendChild(outer);
  }

  return result;
}

function sendToServer(filename, contents) {
  const payload = JSON.stringify({ filename, filecontents: contents });
  fetch("/uploadSubmission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload
  })
    .then((res) => {
      if (res.status === 200) {
        displayMessage("status", `Upload successful: ${filename}`, "green");
      } else {
        displayMessage("status", `Upload failed with status ${res.status}`, "red");
      }
    })
    .catch(() => {
      displayMessage("status", "Upload failed due to network error.", "red");
    });
}

function displayMessage(id, msg, color) {
  const el = document.getElementById(id);
  if (el){
    el.textContent = msg;
    el.style.color = color
  }
}

window.addEventListener("load", () => {
  hideAnalysis();

  const input = document.getElementById("assignmentFile");
  input.addEventListener("change", () => processFile(input, false));

  const uploadBtn = document.getElementById("uploadButton");
  uploadBtn.addEventListener("click", () => uploadSubmission());
});
