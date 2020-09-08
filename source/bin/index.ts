#!/usr/bin/env node
import { program } from "commander";
import { version } from "../../package.json";
import { syncCommand } from "../";

syncCommand(program);

program
  .version(version)
  .parse();
