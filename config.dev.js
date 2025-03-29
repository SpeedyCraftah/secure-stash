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
    // Please change it to something more secure.
    cookie_secret: "K3YB0@RD_SP@M_N0T_S@F3!",

    // Whether to use a TLS (HTTPS) server, recommended (sometimes required) if not using a reverse proxy.
    // Unnecessary if using a reverse proxy, will only add latency and complicate your setup.
    // This option is ignored when using a unix socket since TLS becomes pointless at that point.
    server_tls: {
        enabled: false,
        certificate: "/path/to/some/certificate.pem",
        private_key: "/path/to/some/private_key.key"
    },

    // The server listener, select one and comment out the other, or set to disabled.

    // Listen using a traditional host + port pair (works on 99% of platforms).
    server_port_tcp: { enabled: true, host: "127.0.0.1", port: 3000 },

    // Listen using a unix socket file (faster, more secure, but less flexible & only works on unix + some other systems).
    // Especially recommended if using reverse proxy authentication.
    // Permissions for the socket are specified as octals (default u=rw,g=rw,o=---).
    server_unix_socket_tcp: { enabled: false, path: "/tmp/stash_socket.sock", permissions: 0o750 }
};