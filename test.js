import { spawn } from "child_process";
const p = spawn("powershell", ["-NoLogo"]);
p.stdout.on("data", d => console.log("OUT:", d.toString()));
p.stderr.on("data", d => console.log("ERR:", d.toString()));
p.stdin.write("echo hello\r\n");
setTimeout(() => {
    p.stdin.write("echo world\r\n");
}, 1000);
setTimeout(() => {
    p.kill();
    process.exit(0);
}, 2000);
