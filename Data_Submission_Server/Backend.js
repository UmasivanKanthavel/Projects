import { hash as encrypt, verify as match } from "jsr:@felix/argon2";
import * as db from "./Database.js";
import { checkFile } from "./static/FileValidation.js";

const HTTP = {
  OK: 200,
  REDIR: 303,
  BAD: 400,
  UNAUTH: 401,
  FORBID: 403,
  MISSING: 404,
  FAIL: 500,
  UNSUP: 501,
};

function getMimeType(filePath) {
  const types = {
    css: "text/css",
    html: "text/html",
    js: "text/javascript",
    json: "application/json",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    ico: "image/x-icon",
    pdf: "application/pdf",
    txt: "text/plain",
    };
  const extension = filePath?.split(".").pop().toLowerCase();
  return types[extension] || "application/octet-stream";
}

function htmlShell(pageTitle, content) {
  return `<!DOCTYPE html><html><head><title>${pageTitle}</title><link rel="stylesheet" href="/style.css"></head><body>${content}</body></html>`;
}

function missingPage(path) {
  return htmlShell("404", `<h2>Landed on wrong page. </h2><p>Couldn't locate the following path : ${path}</p>`);
}

function extractCookie(cookieStr, name) {
    if (!cookieStr) return null;
    const cookies = cookieStr.split(';');
    for (const cookie of cookies) {
        const [cookieName, cookieValue] = cookie.trim().split('=');
        if (cookieName === name) {
            return cookieValue;
        }
    }
    return null;
}

function currentSession(request) {
  const cookies = request.headers.get("cookie");
  const sid = extractCookie(cookies, "sessionid");
  return db.getSession(sid);
}

function sendRedirect(dest) {
  return {
    status: HTTP.REDIR,
    contentType: "text/html",
    contents: `Redirecting to ${dest}`,
    location: dest,
  };
}

async function analyzePage() {
  const rawTemplate = await Deno.readTextFile("./static/admin/admin_analysis.html");
  const stats = db.analyzeSubmissions();
  const idsmapped = stats.ShieldIDList.map(id => `<li>${id}</li>`).join("");
  const blankquestionsmapped = stats.blankQuestions.map(q => `<li>${q}</li>`).join("");

  const content = rawTemplate.replace("{{count}}", stats.count).replace("{{ids}}", idsmapped).replace("{{blanks}}", blankquestionsmapped);

  return {
    status: HTTP.OK,
    contentType: "text/html",
    contents: htmlShell("Analysis", content),
    
  };
}

function listAll(req) {
  const session = currentSession(req);
  if (!session) {
    print("here")
    return { status: HTTP.UNAUTH, contentType: "text/plain", contents: "Login required" };
  }

  const user = db.getAccount(session.username);
  if (user?.access !== "admin") {
    return { status: HTTP.FORBID, contentType: "text/plain", contents: "Admins only" };
  }

  const data = db.getAllSubmissions();
  return { status: HTTP.OK, contentType: "application/json", contents: JSON.stringify(data) };
}

async function handleUpload(req) {
  const session = currentSession(req);
  if (!session) {
    return { status: HTTP.UNAUTH, contentType: "text/plain", contents: "Not logged in" };
  }

  const user = db.getAccount(session.username);
  const submission = await req.json();

  if (!submission?.filename || !submission?.filecontents) {
    return { status: HTTP.BAD, contentType: "text/plain", contents: "Missing data" };
  }

  if (user?.access !== "employee") {
    return { status: HTTP.FORBID, contentType: "text/plain", contents: "Not allowed" };
  }

  const parsed = checkFile(submission.filename, submission.filecontents);
  if (!parsed) {
    return { status: HTTP.BAD, contentType: "text/plain", contents: "Invalid content" };
  }

  const saved = db.addSubmission(parsed, submission.filename, submission.filecontents);
  
  if(saved){
    return sendRedirect("/")
  }else{
        return {
            status: HTTP.FAIL,
            contentType: "text/plain",
            contents: "DB error",
        };
    }
}

async function processLogin(req) {
  const form = await req.formData();
  const uname = form.get("username");
  const pass = form.get("password");
  const user = db.getAccount(uname);
  let sid = "UNAUTHORIZED";

  if (user && await match(user.password, pass)) {
    sid = db.newSession(uname);
    const redir = user.access === "admin" ? "/admin/index.html" : "/employee/index.html";
    return { status: 303, contentType: "text/html", location: redir, contents: `Redirect to ${redir}`, sessionid: sid};
  }

  return { status: 303, contentType: "text/html", location: "/FailedLogin.html", contents: "Redirect to /FailedLogin.html", sessionid: sid };
}

async function register(req) {
  const form = await req.formData();
  const newUser = {
    username: form.get("username"),
    password: await encrypt(form.get("password")),
    access: form.get("access"),
    id: form.get("ShieldID"),
    name: form.get("name"),
  };

  const created = db.addAccount(newUser.username, newUser.password, newUser.access, newUser.id, newUser.name);
  if (created) {
    return sendRedirect("/"); 
  } else {
        return {
            status: HTTP.FAIL,
            contentType: "text/plain",
            contents: "Account creation failed",
        };
}

}

async function routeGET(req) {
  const url = new URL(req.url).pathname;
  if (url === "/list") return listAll(req);
  if (url === "/admin/analyze") return analyzePage();
  return null;
}

async function routePOST(req) {
  const url = new URL(req.url).pathname;
  if (url === "/uploadSubmission") return handleUpload(req);
  if (url === "/login") {console.log("LOGIN CALLED"); return processLogin(req);}
  if (url === "/admin/createAcct") return register(req);
  return null;
}

async function routeRequest(req) {
  if (req.method === "GET") return routeGET(req);
  if (req.method === "POST") return routePOST(req);
  return {
    status: HTTP.UNSUP,
    contentType: "text/plain",
    contents: "Method unsupported",
  };
}

async function loadStatic(path) {
  try {
    const data = await Deno.readFile("./static" + path);
    return { status: HTTP.OK, contentType: getMimeType(path), contents: data };
  } catch {
    return { status: HTTP.MISSING, contentType: "text/html", contents: missingPage(path) };
  }
}

async function webHandler(req) {
  const originalPath = new URL(req.url).pathname;
  const finalPath = originalPath === "/" ? "/index.html" : originalPath;

  let response = await routeRequest(req);
  if (!response) response = await loadStatic(finalPath);

  const headers = { "Content-Type": response.contentType };
  if (response.sessionid) headers["Set-Cookie"] = `sessionid=${response.sessionid}`;
  if (response.location) headers["Location"] = response.location;

  console.log(`${response.status} ${req.method} ${originalPath}`);
  return new Response(response.contents, { status: response.status, headers});
}

const stopSignal = new AbortController();

const server = Deno.serve({ port: 8000, hostname: "0.0.0.0", signal: stopSignal.signal }, webHandler);

Deno.addSignalListener("SIGINT", () => {
  console.log("SIGINT caught, closing...");
  stopSignal.abort();
});

server.finished.then(() => {
  console.log("Shutdown complete. Closing DB.");
  db.close();
});