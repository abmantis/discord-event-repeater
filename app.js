import "dotenv/config";
import express from "express";
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from "discord-interactions";
import { VerifyDiscordRequest, DiscordRequest } from "./utils.js";
import {
  Client,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder,
  GuildScheduledEventManager,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventEntityType,
  CDN, GuildScheduledEvent,
} from "discord.js";


const app = express();
const PORT = process.env.PORT || 3000;

const EVENT_START_HOURLY = 3600000;
const EVENT_START_DAILY = 86400000;
const EVENT_START_WEEKLY = 604800000;
const EVENT_START_MONTHLY = 2628000000;

// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

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

client.on("guildScheduledEventCreate", async (m) => {
  console.log("scheduled event created");
  console.log(m);
});

client.on("guildScheduledEventUpdate", async (before, after) => {
  console.log("scheduled event updated");
  console.log(before.name);
  console.log(after);

  //check for indluded words to trigger different events
  /* Scheduled = 1, Active = 2,Completed = 3, Canceled = 4 */

  //trigger on ending an event, if the description includes "daily"
  if ( before.status === 2 && after.status === 3) {
    if(before.description.includes("[hourly]")) {
      setupEvent(before, after, EVENT_START_HOURLY)
    } else if (before.description.includes("[daily]")) {
      setupEvent(before, after, EVENT_START_DAILY)
    } else if (before.description.includes("[weekly]")) {
      setupEvent(before, after, EVENT_START_WEEKLY)
    } else if (before.description.includes("[monthly]")) {
      setupEvent(before, after, EVENT_START_MONTHLY)
    }
  }
});

client.on("guildScheduledEventDelete", async (m) => {
  console.log("scheduled event deleted");
  console.log(m);
});

app.post("/interactions", async function (req, res) {
  const { type, id, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === "help") {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            "Hi! I'm the event repeater bot. Simply add `[hourly]`, `[daily]`, `[weekly]`, or `[monthly]` to your events description, and I'll create a follow-up event as soon as the event ends.",
        },
      });
    }   
  }
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});


async function setupEvent(before, after, timeOffset) {
  console.log("Setting up event")
  const guild = await client.guilds.fetch(before.guildId);
  //const channel = await client.channels.fetch(before.channelId);
  const cdn = new CDN();
  const imageLink = cdn.guildScheduledEventCover(before.id, before.image, {size: 4096,});

  const event_manager = new GuildScheduledEventManager(guild);
  await event_manager.create({
    name: before.name,
    description: before.description,
    scheduledStartTime: before.scheduledStartTimestamp + timeOffset,
    scheduledEndTime: before.scheduledEndTimestamp + timeOffset,
    //channel: channel,
    entityMetadata: before.entityMetadata,
    privacyLevel: 2,
    entityType: 3,
    image: imageLink
  });
}