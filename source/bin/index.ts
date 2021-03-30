#!/usr/bin/env node
import program from "commander-version";
import { syncCommand } from "../";

program(__dirname)
  .addCommand(syncCommand)
  .parse();
