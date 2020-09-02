#!/usr/bin/env node
import { program } from "commander";
import { version } from "@bconnorwhite/module";
import { syncCommand } from "../";

syncCommand(program);
version(program, __dirname);

program.parse(process.argv);
