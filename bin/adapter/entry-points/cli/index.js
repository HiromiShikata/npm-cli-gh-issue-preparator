#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const program = new commander_1.Command();
program
    .argument('<path>', 'Path of example')
    .name('Example CLI')
    .description('This is an example')
    .action(async (path) => {
    console.log(JSON.stringify(path));
});
if (process.argv) {
    program.parse(process.argv);
}
//# sourceMappingURL=index.js.map