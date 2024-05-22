import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

const commands = [
	new SlashCommandBuilder()
		.setName('help')
		.setDescription('How to use the bot?'),
	new SlashCommandBuilder()
		.setName('ping-event')
		.setDescription('Ping everyone that is interested in an event.')
		.addStringOption(option => option
			.setName('message')
			.setDescription('Message to send')
			.setRequired(true))
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

rest.put(Routes.applicationCommands(process.env.APP_ID), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);
