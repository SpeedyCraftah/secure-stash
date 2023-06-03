# Secure Stash Storage
A remote storage stash written in Node.js which provides a front-end and back-end to storing files securely with no trust in the server.

## How is this secure?
- Files, file names and true file sizes are encrypted using AES-256-GCM which includes integrity and tamper protection alongside a strong block cipher.
- The server is never shown or given the decryption key at any point, all decryption and encryption happens client-side, the server only stores the resulting ciphertext.
- Decryption keys are generated to be 256 bits which is the maximum that AES-256 can support and are generated using securely random numbers using the Crypto API.
- Decryption keys can also be generated from a SHA-3-512 hash of a passphrase and can be chain-hashed to further secure the decryption key, which allows the user to remember keys and not have to write them down which could compromise security.
- Stashes can have an automatic deletion date at which they are automatically deleted from the server without user interaction.
- TLS certificate can be used to encrypt the connection between the client and server to further secure data.

## What is shared with the server?
- File name, file size, file type, file data, all in encrypted ciphertext form.
- Stash expiry date, stash name, stash password, all unencrypted.
- Login credentials if logging in and performing a privileged action such as creating a stash.

## Libraries used
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite3 storage of stash names, sessions, etc.
- [cookie-parser](https://github.com/expressjs/cookie-parser) - parsing of incoming and outgoing cookies with encryption.
- [express](https://github.com/expressjs/express) - web server which serves the front-end and handles backend queries.

## Planned features
- Add multiple cipher support such as support for AES-256-CBC which would allow streamed encryption/decryption, bypassing the 2GB blob limit.
- Implement partial stash access which allows users to login using the stash password, but not be able to decrypt any of the files.
- Allow users to use a secure USB to store and exchange the decryption key with the client.
- Better protection against DOS attacks against the server.
- Ability to view images and videos in the stash without having to download the actual files.
- File storage quotas to prevent storing too many files.

## How to run?
Ensure node.js is installed and run `npm install` followed by `node index.js` to start the server.

## Defaults
There currently is no config file so you will have to modify the `index.js` file to modify behaviour/settings to your liking.
- You should change the cookie secret to your own secret value instead of using the default.
- You need to get yourself a TLS certificate for your domain and place them in the `./certs` directory to enable HTTPS.
- You should change the default login credentials which are currently `speedy` and `speedy123` for privileged login, you can also add multiple accounts.