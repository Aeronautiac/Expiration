const { spawn, exec } = require('child_process');
const readline = require('readline');
const path = require('node:path');
const fs = require('node:fs');
const os = require('os');

require('dotenv').config();

// ANSI color helpers
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
    fg: {
        black: '\x1b[30m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
    },
    bg: {
        black: '\x1b[40m',
        red: '\x1b[41m',
        green: '\x1b[42m',
        yellow: '\x1b[43m',
        blue: '\x1b[44m',
        magenta: '\x1b[45m',
        cyan: '\x1b[46m',
        white: '\x1b[47m',
    }
};
function color(text, color) {
    return color + text + colors.reset;
}
function header(text) {
    return color(colors.bright + colors.fg.cyan + text + colors.reset, '');
}
function prompt(text) {
    return color(text, colors.fg.green);
}
function error(text) {
    return color(text, colors.fg.red);
}
function info(text) {
    return color(text, colors.fg.blue);
}
function warn(text) {
    return color(text, colors.fg.yellow);
}

let botProcess = null;
let restarting = false;

function showSystemStats() {
    const cpus = os.cpus();
    const totalMem = os.totalmem() / 1024 / 1024;
    const freeMem = os.freemem() / 1024 / 1024;
    const uptime = os.uptime();
    const load = os.loadavg ? os.loadavg() : [0,0,0];
    console.log(header('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'));
    console.log(header('┃                   System Information                 ┃'));
    console.log(header('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'));
    console.log(info(`Platform: `) + color(os.platform(), colors.fg.yellow));
    console.log(info(`Arch: `) + color(os.arch(), colors.fg.yellow));
    console.log(info(`CPU Cores: `) + color(cpus.length, colors.fg.yellow));
    console.log(info(`CPU Model: `) + color(cpus[0].model, colors.fg.yellow));
    console.log(info(`Total Memory: `) + color(`${totalMem.toFixed(2)} MB`, colors.fg.magenta));
    console.log(info(`Free Memory: `) + color(`${freeMem.toFixed(2)} MB`, colors.fg.magenta));
    if (os.loadavg) {
        console.log(info(`Load Avg (1m/5m/15m): `) + color(load.map(l => l.toFixed(2)).join(', '), colors.fg.green));
    }
}

function printHeader() {
    console.clear();
    console.log(header('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'));
    console.log(header('┃          ExpirationTS Discord Bot Watchdog           ┃'));
    console.log(header('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'));
    showSystemStats();
    console.log(info('Type a command below. Available: reload, stop, status, sys, git'));
    showMemory();
}

function startBot() {
    botProcess = spawn('node', [path.join(__dirname, 'bot.js')], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    botProcess.stdout.on('data', (data) => {
        process.stdout.write(color(`[BOT] `, colors.fg.cyan) + data);
    });
    botProcess.stderr.on('data', (data) => {
        process.stderr.write(parseBotError(data));
    });
    botProcess.on('exit', (code, signal) => {
        if (!restarting) {
            console.log(error(`[WATCHDOG] Bot exited with code ${code}, signal ${signal}. Restarting in 3s...`));
            setTimeout(startBot, 3000);
        }
    });
}

function showMemory() {
    const mem = process.memoryUsage();
    console.log(info(`[WATCHDOG] Memory Usage: `) +
        color(`RSS ${(mem.rss/1024/1024).toFixed(2)} MB`, colors.fg.magenta) + ', ' +
        color(`Heap ${(mem.heapUsed/1024/1024).toFixed(2)} MB`, colors.fg.yellow)
    );
}

function checkRepoStatus() {
    exec('git status -uno', {
        cwd: path.join(__dirname, '../'),
        shell: true
    }, (err, stdout, stderr) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(error('Git is not installed or not in your PATH.'));
            } else {
                console.log(error('Git status check failed:'), err.message);
            }
            if (stderr) console.log(error(stderr));
            return;
        }
        if (stderr) {
            console.log(error(stderr));
        }
        if (stdout.includes('Your branch is behind')) {
            console.log(warn('[WARNING] Your branch is behind the remote. Consider pulling the latest changes.'));
        } else if (stdout.includes('up to date')) {
            console.log(info('[INFO] Repo is up to date.'));
        } else if (stdout.trim().length > 0) {
            console.log(stdout.trim());
        } else {
            console.log(info('[INFO] No output from git.'));
        }
    });
}

function handleCommand(cmd) {
    cmd = cmd.trim().toLowerCase();
    if (cmd === 'reload') {
        if (botProcess) {
            restarting = true;
            botProcess.kill();
            setTimeout(() => {
                restarting = false;
                startBot();
            }, 1000);
            console.log(warn('[WATCHDOG] Reloading bot...'));
        }
    } else if (cmd === 'stop') {
        if (botProcess) {
            restarting = true;
            botProcess.kill();
            console.log(warn('[WATCHDOG] Stopping bot.'));
            process.exit(0);
        }
    } else if (cmd === 'status') {
        showMemory();
    } else if (cmd === 'sys') {
        showSystemStats();
    } else if (cmd === 'git') {
        checkRepoStatus();
    } else {
        console.log(info('[WATCHDOG] Commands: ') + prompt('reload, stop, status, sys, git'));
    }
    rl.prompt();
}

function parseBotError(data) {
    const str = data.toString();
    if (str.includes('MongoParseError') || str.includes('Mongoose') || str.includes('MongoNetworkError')) {
        return error('[MONGODB ERROR] ') + str;
    }
    if (str.includes('DiscordAPIError') || str.includes('discord.js')) {
        return error('[DISCORD ERROR] ') + str;
    }
    if (str.toLowerCase().includes('error')) {
        return error('[BOT ERROR] ') + str;
    }
    return warn(str);
}

printHeader();
startBot();
setInterval(showMemory, 10000);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: prompt('> ')
});

rl.prompt();
rl.on('line', handleCommand);