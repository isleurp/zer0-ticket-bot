import {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const STAFF_ROLE_ID = "1429609760575193266"; // rôle staff
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

const ticketMap = new Map(); // userID -> salonID
const reverseMap = new Map(); // salonID -> userID

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// 💡 Commande !help
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (msg.content.toLowerCase() === "!help") {
    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle("📘 zer0 Ticket Bot - Liste des commandes")
      .setDescription(
        "**Commandes disponibles :**\n" +
        "🎫 `!setup` → Envoie le message avec le bouton pour créer un ticket (staff uniquement)\n" +
        "ℹ️ `!help` → Affiche cette page d’aide"
      )
      .setFooter({ text: "zer0 Ticket System" });
    return msg.reply({ embeds: [embed] });
  }

  // 💠 Commande !setup (seulement pour les STAFFS)
  if (msg.content.toLowerCase() === "!setup") {
    if (!msg.member.roles.cache.has(STAFF_ROLE_ID)) {
      return msg.reply("❌ Seuls les membres du staff peuvent utiliser cette commande.");
    }

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle("🎫 Support - zer0")
      .setDescription("Clique sur le bouton ci-dessous pour créer un ticket avec le staff.")
      .setFooter({ text: "zer0 Ticket System" });

    const bouton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_ticket_menu")
        .setLabel("🎫 Créer un ticket")
        .setStyle(ButtonStyle.Primary)
    );

    await msg.channel.send({ embeds: [embed], components: [bouton] });
    return msg.reply("✅ Message du système de tickets envoyé !");
  }
});

// 🎫 Interaction bouton “Créer un ticket”
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== "open_ticket_menu") return;

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category")
    .setPlaceholder("Choisis la catégorie de ton ticket")
    .addOptions([
      { label: "Dossier entreprises en jeu", value: "entreprise", emoji: "💼" },
      { label: "Dossier organisations en jeu", value: "organisation", emoji: "🛠️" },
      { label: "Demande boutique", value: "boutique", emoji: "🛒" },
      { label: "Demande débannissement", value: "deban", emoji: "⛔" },
      { label: "Remboursement en jeu", value: "remboursement", emoji: "💸" },
    ]);

  const row = new ActionRowBuilder().addComponents(menu);

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle("📩 Choix du sujet")
    .setDescription("Merci de sélectionner le sujet correspondant à votre demande.");

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
});

// 🏗️ Création du ticket
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu() || interaction.customId !== "ticket_category") return;

  const guild = interaction.guild;
  const category = guild.channels.cache.find((c) => c.name === "tickets" && c.type === 4);
  if (!category) {
    return interaction.reply({
      content: "❌ Crée une catégorie appelée **tickets** avant d’ouvrir un ticket.",
      ephemeral: true,
    });
  }

  if (ticketMap.has(interaction.user.id)) {
    return interaction.reply({
      content: "⚠️ Tu as déjà un ticket ouvert.",
      ephemeral: true,
    });
  }

  // Génération d’un ID aléatoire
  const ticketId = Math.floor(1000 + Math.random() * 9000);
  const type = interaction.values[0];
  const channelName = `ticket-${ticketId}-${interaction.user.username}`.toLowerCase();

  const channel = await guild.channels.create({
    name: channelName,
    type: 0,
    parent: category.id,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
      { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

  ticketMap.set(interaction.user.id, channel.id);
  reverseMap.set(channel.id, interaction.user.id);

  await interaction.reply({
    content: `🎫 Ton ticket **#${ticketId}** (${type}) a été créé : ${channel}`,
    ephemeral: true,
  });

  const ticketEmbed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle(`📩 Ticket #${ticketId}`)
    .setDescription(`Type : **${type}**\nCréé par <@${interaction.user.id}>`)
    .setFooter({ text: "zer0 Ticket System" });

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("🔒 Fermer le ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [ticketEmbed], components: [closeBtn] });

  try {
    await interaction.user.send(`🎫 Ton ticket **#${ticketId}** (${type}) a été créé avec succès !`);
  } catch {
    console.log(`Impossible d’envoyer un MP à ${interaction.user.username}`);
  }
});

// 🔒 Fermeture du ticket
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== "close_ticket") return;

  const userId = reverseMap.get(interaction.channel.id);
  const user = userId ? await client.users.fetch(userId).catch(() => null) : null;

  await interaction.reply({ content: "🔒 Fermeture du ticket dans 5 secondes...", ephemeral: true });

  if (user) {
    try {
      await user.send("✅ Ton ticket a été fermé par le staff. Merci d’avoir contacté le support.");
    } catch {
      console.log(`Impossible d'envoyer un MP à ${userId}`);
    }
  }

  setTimeout(async () => {
    await interaction.channel.delete().catch(() => null);
    if (userId) {
      ticketMap.delete(userId);
      reverseMap.delete(interaction.channel.id);
    }
  }, 5000);
});

// 👥 Staff → message MP à l’utilisateur
client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  const userId = reverseMap.get(msg.channel.id);
  if (!userId) return;

  const user = await client.users.fetch(userId).catch(() => null);
  if (user) {
    await user
      .send(`💬 Staff (${msg.author.username}) : ${msg.content}`)
      .catch(() => console.log("MP impossible à envoyer"));
  }
});

// 📩 Utilisateur → message relayé au staff
client.on("messageCreate", async (msg) => {
  if (msg.guild || msg.author.bot) return;

  const channelId = ticketMap.get(msg.author.id);
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel) {
    await channel.send(`📩 ${msg.author.username} : ${msg.content}`);
  }
});

// 🧹 Détection de suppression manuelle du ticket
client.on("channelDelete", async (channel) => {
  if (!reverseMap.has(channel.id)) return;

  const userId = reverseMap.get(channel.id);
  if (userId) {
    ticketMap.delete(userId);
    reverseMap.delete(channel.id);
    console.log(`🧹 Ticket de ${userId} supprimé manuellement, libéré.`);
  }
});

client.login(process.env.TOKEN);
