const fs = require("fs");
const express = require("express");
const cookieParser = require('cookie-parser');
const app = express();
const crypto = require("crypto");
const sqlite3 = require("better-sqlite3");
const config = require("./config.js");
const path = require("path");

if (!fs.existsSync(config.data_location)) {
    fs.mkdirSync(config.data_location);
}

const db = new sqlite3(path.join(config.data_location, "meta.sqlite"));
db.pragma('journal_mode = WAL');

db.prepare(`CREATE TABLE IF NOT EXISTS stashes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    access_value TEXT NOT NULL,
    session TEXT NOT NULL,
    expires BIGINT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    stash_id TEXT NOT NULL,
    name_type TEXT NOT NULL,
    name_type_iv VARCHAR(32) NOT NULL,
    data_iv VARCHAR(32) NOT NULL
)`).run();

if (config.server_port_tcp && config.server_port_tcp.enabled) {
    if (config.server_tls && config.server_tls.enabled) {
        require("https").createServer({
            key: fs.readFileSync(config.server_tls.private_key),
            cert: fs.readFileSync(config.server_tls.certificate)
        }, app).listen(config.server_port_tcp.port, config.server_port_tcp.host, () => {
            console.log(`HTTPS server is listening on port ${config.server_port_tcp.port}`)
        });
    } else {
        require("http").createServer(app).listen(config.server_port_tcp.port, config.server_port_tcp.host, () => {
            console.log(`HTTP server is listening on port ${config.server_port_tcp.port}`)
        });
    }
}

else if (config.server_unix_socket_tcp && config.server_unix_socket_tcp.enabled) {
    if (fs.existsSync(config.server_unix_socket_tcp.path)) fs.rmSync(config.server_unix_socket_tcp.path);
    app.listen(config.server_unix_socket_tcp.path, (err) => {
        if (err) throw err;

        fs.chmodSync(config.server_unix_socket_tcp.path, config.server_unix_socket_tcp.permissions);
        console.log(`Unix socket HTTP server is listening on path '${config.server_unix_socket_tcp.path}'`);
    });
}

else throw new Error("Both unix socket and HTTP server options cannot be disabled!");

app.use(cookieParser(config.cookie_secret), express.json({ strict: true }));

const stashDirectoryPath = path.join(config.data_location, "stashes");
if (!fs.existsSync(stashDirectoryPath)) {
    fs.mkdirSync(stashDirectoryPath);
}

const accounts = config.reverse_proxy_auth_mode === true ? null
    : Object.entries(config.admin_accounts).map(e => ({
        username: e[0],
        password: e[1],
        token: crypto.randomBytes(150).toString("base64")
    })); 

const uploadSessions = {};

// todo - add caching
function fetchStash(id) {
    return db.prepare("SELECT * FROM stashes WHERE id=?").get(id);
}

function deleteStash(id) {
    fs.rmSync(path.join(stashDirectoryPath, id), { recursive: true, force: true });
    db.prepare("DELETE FROM stashes WHERE id=?").run(id);
    db.prepare("DELETE FROM files WHERE stash_id=?").run(id);

    const sessions = Object.entries(uploadSessions);
    for (let i = 0; i < sessions.length; i++) {
        const [id, session] = sessions[i];
        if (session.stash_id === id) {
            delete uploadSessions[i];
        }
    }
}

// Upload session clearing.
setInterval(() => {
    const sessions = Object.entries(uploadSessions);
    for (let i = 0; i < sessions.length; i++) {
        const [id, data] = sessions[i];
        if (Date.now() >= data.expires) {
            delete uploadSessions[id];
        }
    }
}, 20000);

// Stash clearing.
setInterval(() => {
    const stashes = db.prepare("SELECT id FROM stashes WHERE expires NOT NULL AND ? >= expires").all(Date.now());
    for (let i = 0; i < stashes.length; i++) {
        deleteStash(stashes[i].id);
    }
}, 60000);

async function auth(req, res, next) {
    if (config.reverse_proxy_auth_mode === true) {
        if (!!req.headers["x-webauth-proxied"]) return next();
        else return res.status(401).send();
    }

    if (req.signedCookies["auth"]) {
        const acc = accounts.find(a => a.token === req.signedCookies["auth"]);
        if (acc) {
            req.auth = acc;
            return next();
        } else res.clearCookie("auth");
    }

    if (req.method !== "GET") return res.status(401).send();
    res.sendFile(__dirname + "/web-contextual/auth.html");
}

async function stashAuth(req, res, next) {
    const id = req.params["stash_id"];
    let stash = fetchStash(id);

    if (stash && stash.expires && Date.now() > stash.expires) {
        deleteStash(id);
        stash = null;
    }

    if (req.method === "GET") {
        if (!stash) {
            res.clearCookie("stash-access");
            return res.redirect(`/stash/${id}`);
        }

        // todo - redirect to stash sign in page
        const cookie = req.signedCookies["stash-access"];
        if (!cookie) return res.redirect(`/stash/${id}`);

        if (cookie !== stash.session) {
            res.clearCookie("stash-access");
            return res.redirect(`/stash/${id}`);
        }
    } else {
        if (!stash) return res.status(404).send();

        const header = req.headers["x-stash-access"];
        if (!header || header !== stash.session) return res.status(401).send();
    }

    req.stash = stash;
    next();
}

app.get("/stash/new", auth, (req, res) => {
    res.sendFile(__dirname + "/web/new.html");
});

app.get("/auth/popup", (req, res) => {
    return res.sendFile(__dirname + "/web-contextual/auth-popup.html");
});

app.get("/stash/:stash_id", (req, res) => {
    const stash = fetchStash(req.params["stash_id"]);

    if (stash) {
        const cookie = req.signedCookies["stash-access"];
        if (cookie && stash.session === cookie) return res.redirect(`/stash/${stash.id}/view`);

        res.status(200).sendFile(__dirname + "/web/stash-login.html");
    } else res.status(404).sendFile(__dirname + "/web-contextual/stash-404.html");
});

if (config.reverse_proxy_auth_mode === false) {
    let accountAuthAttempts = 0;
    app.post("/api/auth", (req, res) => {
        if (!req.body.username || !req.body.password) return res.status(400).send();
    
        if (accountAuthAttempts > 10) return res.status(429).send();
        accountAuthAttempts++;
    
        const acc = accounts.find(a => a.username === req.body.username);
        if (!acc || acc.password !== req.body.password) return res.status(401).send();
    
        res.status(201).cookie("auth", acc.token, { signed: true, maxAge: 6.048e+8, secure: true }).send();
    });
    
    setInterval(() => {
        accountAuthAttempts = 0;
    }, 120000);
}

app.get("/api/is_rp_auth", (req, res) => {
    res.status(200).send(config.reverse_proxy_auth_mode === true ? "1" : "0");
});

app.post("/api/admin/stash/create", auth, (req, res) => {
    if (!req.body.access_value || typeof req.body.access_value !== "string" || req.body.access_value.length > 40 || req.body.access_value.length < 10) {
        return res.status(400).send();
    }

    if (!req.body.name || typeof req.body.name !== "string" || req.body.name.length > 50 || req.body.name.trim().length < 3 || !(/^[0-9a-zA-Z\s]+$/).test(req.body.name)) {
        return res.status(400).send();
    }

    req.body.name = req.body.name.trim();

    if (req.body.date && (typeof req.body.date !== "string" || isNaN(req.body.date))) {
        return res.status(400).send();
    }
    
    const data = {
        id: crypto.randomUUID(),
        name: req.body.name,
        access_value: req.body.access_value,
        expires: req.body.date ? parseInt(req.body.date) : null,
        session: crypto.randomBytes(100).toString("base64")
    };

    db.prepare("INSERT INTO stashes(id,name,access_value,expires,session) VALUES(?,?,?,?,?)").run(data.id, data.name, data.access_value, data.expires, data.session);
    fs.mkdirSync(path.join(stashDirectoryPath, data.id));

    res.status(200).json({ id: data.id, session: data.session });
});

app.post("/api/admin/stash/:stash_id/upload", auth, stashAuth, (req, res) => {
    const id = req.params["stash_id"];

    if (!req.body.nameType || typeof req.body.nameType !== "object" || typeof req.body.nameType.iv !== "string" || req.body.nameType.iv.length !== 32 || typeof req.body.nameType.ciphertext !== "string") {
        return res.status(400).send();
    }

    if (!req.body.data || typeof req.body.data !== "object" || typeof req.body.data.iv !== "string" || req.body.data.iv.length !== 32 || typeof req.body.data.size !== "number" || req.body.data.size < 0) {
        return res.status(400).send();
    }

    const sid = crypto.randomUUID();

    uploadSessions[sid] = req.body;
    uploadSessions[sid].expires = Date.now() + 30000;
    uploadSessions[sid].stash_id = id;

    res.status(202).json({ session_id: sid });
});

app.put("/api/admin/stash/:stash_id/upload/:sid", auth, stashAuth, (req, res) => {
    const id = req.params["stash_id"];
    const sid = req.params["sid"];

    const session = uploadSessions[sid];
    if (!session || session.stash_id !== id) return res.status(404).send();
    session.expires = Infinity;

    const fileLocation = path.join(stashDirectoryPath, id, sid);
    const writeStream = fs.createWriteStream(fileLocation, { encoding: "binary" });

    let totalWritten = 0;
    req.on("data", chunk => {
        totalWritten += chunk.byteLength;
        if (totalWritten > session.data.size) {
            writeStream.end();
            res.status(400).send();
            req.socket.destroy();
            fs.rmSync(fileLocation);
            delete uploadSessions[sid];
            return;
        }

        writeStream.write(chunk);
    });

    req.on("end", () => {
        if (req.socket.destroyed) return;

        writeStream.end();
        if (totalWritten !== session.data.size) {
            res.status(400).send();
            fs.rmSync(fileLocation);
            delete uploadSessions[sid];
            return;
        }

        db.prepare("INSERT INTO files(id,stash_id,name_type,name_type_iv,data_iv) VALUES(?,?,?,?,?)").run(sid, id, session.nameType.ciphertext, session.nameType.iv, session.data.iv);
        delete uploadSessions[sid];

        res.status(201).send();
    });
});

app.get("/api/stash/:stash_id/files", stashAuth, (req, res) => {
    const files = db.prepare("SELECT * FROM files WHERE stash_id=?").all(req.stash.id);
    res.status(200).json({ files: files.map(f => ({ id: f.id, nameType: { iv: f.name_type_iv, ciphertext: f.name_type }, data: { iv: f.data_iv } })) });
});

app.delete("/api/admin/stash/:stash_id", auth, stashAuth, (req, res) => {
    deleteStash(req.stash.id);
    res.status(201).send();
});

let stashAuthAttempts = 0;
app.post("/api/stash/:stash_id/auth", (req, res) => {
    if (!req.body.access_value || typeof req.body.access_value !== "string") return res.status(400).send();

    if (stashAuthAttempts > 15) return res.status(429).send();
    stashAuthAttempts++;

    const stash = fetchStash(req.params["stash_id"]);
    if (!stash) return res.status(404).send();
    if (stash.access_value !== req.body.access_value) return res.status(401).send();

    res.status(200)
        .cookie("stash-access", stash.session, { signed: true, secure: true, path: `/stash/${stash.id}` })
        .cookie("stash-access", stash.session, { signed: true, secure: true, path: `/api/stash/${stash.id}` })
        .json({ session: stash.session });
});

setInterval(() => {
    stashAuthAttempts = 0;
}, 60000);

app.get("/api/stash/:stash_id/info", stashAuth, (req, res) => {
    return res.status(200).json({ id: req.stash.id, name: req.stash.name, expires: req.stash.expires });
});

app.get("/stash/:stash_id/view", stashAuth, (req, res) => {
    res.sendFile(__dirname + "/web/stash-view.html")
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/web/index.html")
});

app.get("/favicon.ico", (req, res) => {
    res.sendFile(__dirname + "/web/favicon.ico");
});

app.get("/api/stash/:stash_id/files/:file_id/download", stashAuth, (req, res) => {
    const fileID = req.params["file_id"];
    const fileData = db.prepare("SELECT id FROM files WHERE stash_id=? AND id=?").get(req.stash.id, fileID);
    if (!fileData) return res.status(404).send();

    const fileStat = fs.statSync(path.join(stashDirectoryPath, req.stash.id, fileID));
    res.setHeader('Content-Type', 'application/octet-stream')
    .setHeader('Content-Length', fileStat.size)
    .status(200);

    const fileStream = fs.createReadStream(path.join(stashDirectoryPath, req.stash.id, fileID));
    fileStream.pipe(res);
});