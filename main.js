"use strict";

const {
    app,
    BrowserWindow,
    shell
} = require("electron");

const path = require("path");
const fs = require("fs");
const http = require("http");

let mainWindow = null;
let localServer = null;

const ROOT =
    __dirname;

const MIME_TYPES = {
    ".html":
        "text/html; charset=utf-8",

    ".js":
        "text/javascript; charset=utf-8",

    ".css":
        "text/css; charset=utf-8",

    ".json":
        "application/json; charset=utf-8",

    ".png":
        "image/png",

    ".jpg":
        "image/jpeg",

    ".jpeg":
        "image/jpeg",

    ".gif":
        "image/gif",

    ".svg":
        "image/svg+xml",

    ".webp":
        "image/webp",

    ".ico":
        "image/x-icon",

    ".mp3":
        "audio/mpeg",

    ".mp4":
        "video/mp4",

    ".woff":
        "font/woff",

    ".woff2":
        "font/woff2"
};


function startLocalServer() {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            localServer =
                http.createServer(
                    (
                        request,
                        response
                    ) => {

                        let requestPath;

                        try {

                            requestPath =
                                decodeURIComponent(
                                    request.url
                                        .split("?")[0]
                                );

                        } catch {

                            response.writeHead(
                                400
                            );

                            response.end(
                                "Bad request"
                            );

                            return;
                        }

                        if (
                            !requestPath ||
                            requestPath === "/"
                        ) {

                            requestPath =
                                "/index.html";
                        }

                        const safePath =
                            path.normalize(
                                path.join(
                                    ROOT,
                                    requestPath
                                )
                            );

                        if (
                            safePath !== ROOT &&
                            !safePath.startsWith(
                                ROOT +
                                    path.sep
                            )
                        ) {

                            response.writeHead(
                                403
                            );

                            response.end(
                                "Forbidden"
                            );

                            return;
                        }

                        fs.readFile(
                            safePath,
                            (
                                error,
                                data
                            ) => {

                                if (error) {

                                    response.writeHead(
                                        error.code ===
                                            "ENOENT"
                                            ? 404
                                            : 500,
                                        {
                                            "Content-Type":
                                                "text/plain; charset=utf-8"
                                        }
                                    );

                                    response.end(
                                        error.code ===
                                            "ENOENT"
                                            ? "Not found"
                                            : "Server error"
                                    );

                                    return;
                                }

                                const ext =
                                    path.extname(
                                        safePath
                                    )
                                        .toLowerCase();

                                response.writeHead(
                                    200,
                                    {
                                        "Content-Type":
                                            MIME_TYPES[
                                                ext
                                            ] ||
                                            "application/octet-stream",

                                        "Cache-Control":
                                            "no-cache"
                                    }
                                );

                                response.end(
                                    data
                                );
                            }
                        );
                    }
                );

            localServer.once(
                "error",
                reject
            );

            localServer.listen(
                0,
                "127.0.0.1",
                () => {

                    const address =
                        localServer.address();

                    if (
                        !address ||
                        typeof address ===
                            "string"
                    ) {

                        reject(
                            new Error(
                                "Local server portini olish imkonsiz."
                            )
                        );

                        return;
                    }

                    const url =
                        `http://127.0.0.1:${address.port}`;

                    console.log(
                        "RAUPOWTube local server:",
                        url
                    );

                    resolve(url);
                }
            );
        }
    );
}


async function createWindow() {

    const localURL =
        await startLocalServer();

    mainWindow =
        new BrowserWindow({

            width: 1440,

            height: 900,

            minWidth: 360,

            minHeight: 640,

            backgroundColor:
                "#0f0f0f",

            show: false,

            autoHideMenuBar:
                true,

            title:
                "RAUPOWTube",

            webPreferences: {

                nodeIntegration:
                    false,

                contextIsolation:
                    true,

                sandbox:
                    true
            }
        });

    await mainWindow.loadURL(
        `${localURL}/index.html`
    );

    mainWindow.once(
        "ready-to-show",
        () => {

            mainWindow.show();
        }
    );

    mainWindow.webContents
        .setWindowOpenHandler(
            ({ url }) => {

                if (
                    url.startsWith(
                        "https://"
                    ) ||
                    url.startsWith(
                        "http://"
                    )
                ) {

                    shell.openExternal(
                        url
                    );
                }

                return {
                    action:
                        "deny"
                };
            }
        );

    mainWindow.on(
        "closed",
        () => {

            mainWindow =
                null;
        }
    );
}


app.whenReady()
    .then(
        async () => {

            try {

                await createWindow();

            } catch (error) {

                console.error(
                    "RAUPOWTube startup error:",
                    error
                );
            }

            app.on(
                "activate",
                async () => {

                    if (
                        BrowserWindow
                            .getAllWindows()
                            .length === 0
                    ) {

                        await createWindow();
                    }
                }
            );
        }
    );


app.on(
    "window-all-closed",
    () => {

        if (localServer) {

            localServer.close();

            localServer =
                null;
        }

        if (
            process.platform !==
            "darwin"
        ) {

            app.quit();
        }
    }
);


app.on(
    "before-quit",
    () => {

        if (localServer) {

            localServer.close();

            localServer =
                null;
        }
    }
);