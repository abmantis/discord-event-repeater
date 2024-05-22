import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CDN,
  Client,
  Collection,
  CommandInteraction,
  ComponentType,
  Events,
  GatewayIntentBits,
  GuildScheduledEvent,
  GuildScheduledEventManager,
  GuildScheduledEventStatus,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildScheduledEvents,
  ],
});

client.login().then(r => console.log("login success")).catch(e => {
  console.log("login failed");
  console.error(e);
});

client.on(Events.GuildScheduledEventCreate, async (m) => {
  console.log("scheduled event created");
});

client.on(Events.GuildScheduledEventUpdate, async (before, after) => {
  console.log(`scheduled event ${before.name} updated`);

  const EVENT_START_HOURLY = 3600000;
  const EVENT_START_DAILY = 86400000;
  const EVENT_START_WEEKLY = 604800000;
  const EVENT_START_MONTHLY = 2628000000;

  if (before.status === GuildScheduledEventStatus.Active
    && after.status === GuildScheduledEventStatus.Completed) {
    if (before.description.includes("[hourly]")) {
      setupEvent(before, EVENT_START_HOURLY)
    } else if (before.description.includes("[daily]")) {
      setupEvent(before, EVENT_START_DAILY)
    } else if (before.description.includes("[weekly]")) {
      setupEvent(before, EVENT_START_WEEKLY)
    } else if (before.description.includes("[monthly]")) {
      setupEvent(before, EVENT_START_MONTHLY)
    }
  }
});

client.on(Events.GuildScheduledEventDelete, async (m) => {
  console.log("scheduled event deleted");
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isCommand()) return;

  const name = interaction.commandName;

  if (name === 'help') {
    await interaction.reply({
      content: "Hi! I'm the event repeater bot. Simply add `[hourly]`, `[daily]`, `[weekly]`, or `[monthly]` to your events description, and I'll create a follow-up event as soon as the event ends.",
      ephemeral: true
    });
  } else if (name === 'ping-event') {
    handlePingEventCommand(interaction);
  }
});

/**
 * @param {CommandInteraction} interaction
 */
async function handlePingEventCommand(interaction) {
  const pingMessage = interaction.options.getString('message');

  const events = await getEvents(interaction.guildId);

  if (events.size === 0) {
    await interaction.reply({
      content: 'No events found.',
      ephemeral: true
    });
    return;
  }

  const selectOptions = events.map((event, snowflake) => {
    return new StringSelectMenuOptionBuilder()
      .setLabel(event.name)
      .setValue(snowflake);
  });

  const eventSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('select')
    .setPlaceholder('Nothing selected')
    .addOptions(selectOptions);
  const response = await interaction.reply({
    content: 'Which event to ping?',
    components: [new ActionRowBuilder().addComponents(eventSelectMenu)],
    ephemeral: true
  });

  try {
    const collectedEventSelect = await response.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
    });

    const selectedEventSnowflake = collectedEventSelect.values[0];
    const selectedEvent = events.get(selectedEventSnowflake);

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm')
      .setLabel('Ping!')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    await collectedEventSelect.update({
      content: `Will ping everyone in **"${selectedEvent.name}"**, with:\n\`\`\`\n${pingMessage}\n\`\`\``,
      components: [new ActionRowBuilder().addComponents(cancelButton, confirmButton)],
    });

    const collectedConfirmButton = await response.awaitMessageComponent({
      componentType: ComponentType.Button,
    });

    if (collectedConfirmButton.customId !== 'confirm') {
      await collectedConfirmButton.update({ content: "Ping canceled.", components: [] });
      return;
    }

    await collectedConfirmButton.update({ content: "Will ping now.", components: [] });

    const subscribers = await selectedEvent.fetchSubscribers({ withMember: false });
    const subscriberUsers = subscribers.map(user => {
      return `${user.user}`;
    }).join(" ");

    await collectedConfirmButton.followUp({ content: `${pingMessage}\n\n${subscriberUsers}` });

  } catch (e) {
    await interaction.editReply({
      content: 'Interaction timeout.',
      components: [],
      ephemeral: true
    });
  }
}

/**
 * @returns {Promise<Collection<import("discord.js").Snowflake, GuildScheduledEvent>>}
 */
async function getEvents(guildId) {
  const guild = await client.guilds.fetch(guildId);
  const eventManager = new GuildScheduledEventManager(guild);
  return await eventManager.fetch();
}

async function setupEvent(before, timeOffset) {
  console.log("Setting up event")
  const guild = await client.guilds.fetch(before.guildId);
  const cdn = new CDN();
  const imageLink = cdn.guildScheduledEventCover(before.id, before.image, { size: 4096, });

  const event_manager = new GuildScheduledEventManager(guild);
  await event_manager.create({
    name: before.name,
    description: before.description,
    scheduledStartTime: before.scheduledStartTimestamp + timeOffset,
    scheduledEndTime: before.scheduledEndTimestamp + timeOffset,
    entityMetadata: before.entityMetadata,
    privacyLevel: 2,
    entityType: 3,
    image: imageLink
  });
}
