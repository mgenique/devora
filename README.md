# Run the server

Start the app manually:

```bash
npm run start
```

# Run automatically on Linux (systemd)

You can configure the app to start automatically on login using a user-level systemd service, so you don’t need to open a terminal.

## 1. Create the service file

Create the file:

```bash
~/.config/systemd/user/devora.service
```

Add the following content (adjust paths to match your system):

```
[Unit]
Description=Devora dev bridge (Jira/Azure/Claude)
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/YOURUSER/repos/devora
ExecStart=/home/YOURUSER/.nvm/versions/node/v24.14.1/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=NODE_EXTRA_CA_CERTS=/home/YOURUSER/.crt/rva-all.crt

[Install]
WantedBy=default.target
```

## 2. Enable and start the service

Run:

```bash
systemctl --user daemon-reload
systemctl --user enable devora
systemctl --user start devora
```
