import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "./db.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.ENTERPRISES_CHANNEL_ID;

// ================== COMMANDES ==================

const commands = [
  new SlashCommandBuilder()
    .setName("entreprise-add")
    .setDescription("Ajouter une entreprise")
    .addStringOption(o => o.setName("nom").setDescription("Nom de l'entreprise").setRequired(true))
    .addStringOption(o => o.setName("gerant").setDescription("Nom du gérant").setRequired(true))
    .addStringOption(o => o.setName("type").setDescription("legal ou illegal").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Description").setRequired(false))
    .addStringOption(o => o.setName("discord").setDescription("Lien discord").setRequired(false)),

  new SlashCommandBuilder()
    .setName("entreprise-remove")
    .setDescription("Supprimer une entreprise")
    .addStringOption(o => o.setName("nom").setDescription("Nom de l'entreprise").setRequired(true)),

  new SlashCommandBuilder()
    .setName("entreprise-list")
    .setDescription("Lister les entreprises")
];

// ================== BOT READY ==================

client.once("ready", async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: commands.map(c => c.toJSON())
  });

  console.log("✅ Commandes enregistrées");
  await updateMessage();
});

// ================== INTERACTIONS ==================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "entreprise-add") {
    const nom = interaction.options.getString("nom");
    const gerant = interaction.options.getString("gerant");
    const type = interaction.options.getString("type");
    const description = interaction.options.getString("description") || "";
    const discord = interaction.options.getString("discord") || "";

    if (!["legal", "illegal"].includes(type)) {
      return interaction.reply({ content: "❌ Type invalide (legal ou illegal)", ephemeral: true });
    }

    db.prepare(`
      INSERT INTO enterprises (name, manager, discord, description, type, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(nom, gerant, discord, description, type, Date.now());

    await updateMessage();
    interaction.reply(`✅ Entreprise **${nom}** ajoutée`);
  }

  if (interaction.commandName === "entreprise-remove") {
    const nom = interaction.options.getString("nom");

    db.prepare("DELETE FROM enterprises WHERE name = ?").run(nom);
    await updateMessage();

    interaction.reply(`🗑 Entreprise **${nom}** supprimée`);
  }

  if (interaction.commandName === "entreprise-list") {
    const rows = db.prepare("SELECT * FROM enterprises").all();
    if (!rows.length) return interaction.reply("Aucune entreprise");

    const list = rows.map(e => `• ${e.name} (${e.type})`).join("\n");
    interaction.reply(list);
  }
});

// ================== MESSAGE AUTO ==================

async function updateMessage() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return;

  const rows = db.prepare("SELECT * FROM enterprises ORDER BY type, name").all();

  const legal = rows.filter(e => e.type === "legal");
  const illegal = rows.filter(e => e.type === "illegal");

  const embed = new EmbedBuilder()
    .setTitle("📊 Entreprises actives")
    .setColor(0x00ff99)
    .setTimestamp();

  embed.addFields(
    {
      name: "✅ Entreprises légales",
      value: legal.length ? legal.map(e => `🏢 **${e.name}**\n👤 ${e.manager}\n📝 ${e.description || "—"}`).join("\n\n") : "Aucune"
    },
    {
      name: "🚫 Entreprises illégales",
      value: illegal.length ? illegal.map(e => `🏢 **${e.name}**\n👤 ${e.manager}\n📝 ${e.description || "—"}`).join("\n\n") : "Aucune"
    }
  );

  const messages = await channel.messages.fetch({ limit: 5 });
  const botMsg = messages.find(m => m.author.id === client.user.id);

  if (botMsg) {
    await botMsg.edit({ embeds: [embed] });
  } else {
    await channel.send({ embeds: [embed] });
  }
}

client.login(TOKEN);
