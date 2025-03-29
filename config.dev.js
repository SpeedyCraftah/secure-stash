const path = require("path");

module.exports = {
    // Location of the data directory which will store the database and stash files.
    data_location: path.join(__dirname, "data"),

    // If set to true, the app will not perform any authentication checks and will leave it up to the reverse proxy.
    // DO NOT SET THIS TO TRUE IF YOUR REVERSE PROXY DOES NOT ENSURE A USER IS AUTHENTICATED!
    // If false, it will use the user accounts found here and generate tokens for them during runtime.
    reverse_proxy_auth_mode: false,

    // Ignored if reverse_proxy_auth_mode is set to true.
    // Specifies the admin accounts by key=username, value=password.
    // Please note plain text passwords are quite unsafe, use reverse proxy authentication for better security
    // however hashed passphrases may be added in the future.
    admin_accounts: {
        "admin": "please change me!"
    },

    // The secret to use when encrypting cookies, it must be kept the same.
    // And if you haven't noticed, I did spam my keyboard to generate this, so please change it to something more secure.
    cookie_secret: "SAGJNAEOGIEGad24901J£%j($QKg"
};