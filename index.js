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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const ticketMap = new Map(); // userID -> salonID

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// Commande !setup pour envoyer le menu principal
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (msg.content.toLowerCase() === "!setup") {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return msg.reply("❌ Tu n’as pas la permission d’utiliser cette commande.");
    }

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle("🎫 Support - zer0")
      .setDescription("Pour créer un ticket, clique sur le bouton ci-dessous puis choisis le type de demande.");

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

// Interaction avec le bouton “Créer un ticket”
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "open_ticket_menu") return;

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_category")
    .setPlaceholder("Choisir le sujet de votre demande")
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

// Quand un utilisateur choisit une catégorie
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "ticket_category") return;

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

  const type = interaction.values[0];
  const channelName = `ticket-${type}-${interaction.user.username}`;

  const channel = await guild.channels.create({
    name: channelName.toLowerCase(),
    type: 0,
    parent: category.id,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ],
  });

  ticketMap.set(interaction.user.id, channel.id);

  await interaction.reply({
    content: `🎫 Ton ticket **${type}** a été créé : ${channel}`,
    ephemeral: true,
  });

  const ticketEmbed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle("📩 Nouveau Ticket")
    .setDescription(`Ticket créé par <@${interaction.user.id}> (${type})`)
    .setFooter({ text: "zer0 Ticket System" });

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("close_ticket")
      .setLabel("🔒 Fermer le ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [ticketEmbed], components: [closeBtn] });
});

// Fermeture du ticket
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "close_ticket") return;

  const userId = [...ticketMap.entries()].find(([, ch]) => ch === interaction.channel.id)?.[0];
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
    if (userId) ticketMap.delete(userId);
  }, 5000);
});

client.login(process.env.TOKEN);
