import { Client, GatewayIntentBits, Partials, PermissionsBitField } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const ticketMap = new Map(); // userID -> salonID

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// Commande !ticket
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.content.toLowerCase() !== "!ticket") return;

  const guild = msg.guild;
  const category = guild.channels.cache.find(c => c.name === "tickets" && c.type === 4);
  if (!category) return msg.reply("❌ Crée une catégorie appelée **tickets** avant d’ouvrir un ticket.");

  const channel = await guild.channels.create({
    name: `ticket-${msg.author.username}`,
    type: 0,
    parent: category.id,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: msg.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  ticketMap.set(msg.author.id, channel.id);
  msg.reply("🎫 Ton ticket a été ouvert !");
  channel.send(`👋 Ticket ouvert par <@${msg.author.id}>`);
});

// Staff → MP utilisateur
client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  const userId = [...ticketMap.entries()].find(([, ch]) => ch === msg.channel.id)?.[0];
  if (!userId) return;

  const user = await client.users.fetch(userId);
  await user.send(`💬 Staff : ${msg.content}`).catch(() => console.log("DM impossible."));
});

// Utilisateur → salon staff
client.on("messageCreate", async (msg) => {
  if (msg.guild || msg.author.bot) return;
  const channelId = ticketMap.get(msg.author.id);
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel) channel.send(`📩 ${msg.author.username} : ${msg.content}`);
});

client.login(process.env.TOKEN);
