const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

const args = ["run", "--path", "./.chroma-data", "--port", "8000"];
const candidates = [
    process.env.CHROMA_CLI,
    join(homedir(), "AppData", "Roaming", "Python", "Python313", "Scripts", "chroma.exe"),
    join(homedir(), "AppData", "Roaming", "Python", "Python312", "Scripts", "chroma.exe"),
    "chroma"
].filter(Boolean);

const chromaBin = candidates.find((candidate) =>
    candidate.includes("/") || candidate.includes("\\")
        ? existsSync(candidate)
        : true
);

if (!chromaBin) {
    console.error(
        "chroma CLI not found. Install with: pip install chromadb\n" +
            "Then add Python Scripts to PATH or set CHROMA_CLI to the full chroma.exe path."
    );
    process.exit(1);
}

const child = spawn(chromaBin, args, { stdio: "inherit", shell: chromaBin === "chroma" });
child.on("exit", (code) => process.exit(code ?? 1));
