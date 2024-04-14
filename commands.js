import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

const HELP_COMMAND = {
  name: 'ping',
  description: 'Help command',
  type: 1,
};

const ALL_COMMANDS = [HELP_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);