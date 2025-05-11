import { expectedQuestions } from "/FileValidation.js";

function renderTable(data) {
  const tableBody = document.querySelector("#table");
  const headingsRow = document.getElementById("headings");


  const questionHeaders = expectedQuestions.map(q => `<th>Question ${q}</th>`).join("");
  headingsRow.innerHTML += questionHeaders;

  const fields = ["id", "ShieldID", "name"];

  for (let qnum of expectedQuestions) {
    fields.push("q" + qnum);
  }

  const rows = data.map(entry => {
    const cells = fields.map(field => `<td>${entry[field] ?? ""}</td>`).join("");
    return `<tr>${cells}</tr>`;
  });

  tableBody.innerHTML = rows.join("\n");
}

async function loadAndDisplayTable() {
  try {
    const response = await fetch("/list");
    if (!response.ok) {
      console.error("Failed to load table:", res.status);
      return;
    }

    const data = await response.json();
    print(data)
    renderTable(data);
    console.log("Table updated!");
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

loadAndDisplayTable().then(() => {console.log("Table updated!");});