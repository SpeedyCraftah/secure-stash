**Note:** This is a public mirror. Not much has changed however; issues & pull requests here are still accepted.

# Secure Stash Storage
An end-to-end encrypted remote storage stash written in Node.js which provides a front-end and back-end to storing files securely with no trust in the server.

## How to run?
- Copy `config.dev.js` and save as `config.js`, then change the config values to suit your requirements.
- Ensure node.js is installed, run `npm install`, then run `node index.js` to start the server.

## How to update?
If you've cloned the project using `git clone`, updating is as simple as running `git pull origin master`.
*Do note config values may change from time to time, so if things don't work as expected after an update, see if `config.dev.js` was updated.*

## What is reverse proxy auth mode?
This project is designed to work well when using a reverse proxy for authorization (assuming the below configurations were made), essentially having admin access from the reverse proxy instead of using the built-in accounts. 
This also protects sensitive parts of the app such as admin API's to only authorized users.
You can enable reverse proxy mode by setting the config to `true`.

### Configurations?
For reverse proxy authorization to work properly, setup the following rules on the reverse proxy for these paths:
- Path `/` (aka: everything, default)
  - Proxy request to the server as normal.
- Path `/stash/new` & Path `/api/admin` & Path `/auth/popup`
  - Authorize the user with your reverse proxy's flow.
    - If the user is not authorized and request is not a `GET`, return a `4xx` status.
  - Set the header `x-webauth-proxied` (value does not matter).
  - Proxy request to the server as normal.

## How is this secure?
- Files, file names and true file sizes are encrypted using AES-256-GCM which includes integrity and tamper protection alongside a strong block cipher.
- The server is never shown or given the decryption key at any point, all decryption and encryption happens client-side, the server only stores the resulting ciphertext.
- Decryption keys are generated to be 256 bits which is the maximum that AES-256 can support and are generated using securely random numbers using the Crypto API, or optionally provided by the user if the Crypto API cannot be trusted to derive an unpredictable byte sequence.
- Decryption keys can also be generated from a SHA-3-512 hash of a passphrase and can be chain-hashed to further secure the decryption key, which allows the user to remember keys and not have to write them down which could compromise security.
- Stashes can have an automatic deletion date at which they are automatically deleted from the server without user interaction.
- TLS certificate can be used to encrypt the connection between the client and server to further secure data.

## What is shared with the server?
- File name, file size, file type, file data, all in encrypted ciphertext form.
- Stash expiry date, stash name, stash password (derived from the first part of the generated key, not used in actual encryption), all unencrypted.
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
- Take away trust in JavaScript's Crypto API in generating random keys by adding a manual entropy mode such as mouse/keyboard inputs.
- Securely erase the stash files when deleted by overwriting the file with random bytes (effectively performing a DoD5220.22-M-compliant wipe on the stash files).


## Potential security threats
- If an attacker were to obtain access to the server, they could modify the served front-end JavaScript to send the key to the server or some other remote location so that the data on the server can be decrypted, or skip encryption all-together and send uploaded files unencrypted.
  - This threat is planned to be mitigated by creating a browser extension, or something similar, which automatically verifies the integrity of the front-end page with known safe hashes, or PGP signatures of the pages only the owner can sign.
    
- Due to the nature of JavaScript and browsers, decryption keys could be kept in memory for an unlimited amount of time, and even potentially end up in swap space or other parts of memory, which an attacker could retrieve if they have remote or physical access to the system, known as a memory scraping attack.
  - There is no real mitigation to this at the moment as the storage of values and buffers is entirely up to the JavaScript engine, and cannot be influenced by the running code in any useful capacity, as would be the case with software on machines written in C, for example.

## Screenshots
![image](https://github.com/SpeedyCraftah/secure-stash/assets/45142584/d1045088-b7c2-48e7-9d1f-f1f9d05f9ef0)
![image](https://github.com/SpeedyCraftah/secure-stash/assets/45142584/7b05e058-df91-4ba6-9f37-157a752c0833)
![image](https://github.com/SpeedyCraftah/secure-stash/assets/45142584/22cfc428-f51b-4a7f-8a42-119c7fc439ae)
![image](https://github.com/SpeedyCraftah/secure-stash/assets/45142584/89071733-028c-4fe6-b4f6-c49746d44ed2)

## Credits
- Favicon by [Free Preloaders](https://freeicons.io).