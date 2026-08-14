const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("plainte")
    .setDescription("Déposer une plainte")
    .addUserOption(option =>
      option
        .setName("accuse")
        .setDescription("Personne accusée")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("motif")
        .setDescription("Motif de la plainte")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("description")
        .setDescription("Description de la plainte")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("plaintes")
    .setDescription("Voir toutes les plaintes"),

  new SlashCommandBuilder()
    .setName("audience")
    .setDescription("Ouvrir une audience")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("condamner")
    .setDescription("Déclarer un accusé coupable")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("peine")
        .setDescription("Peine prononcée")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("acquitter")
    .setDescription("Déclarer un accusé non coupable")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("raison")
        .setDescription("Raison de l'acquittement")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("verdict")
    .setDescription("Consulter le verdict")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("fermer")
    .setDescription("Fermer une affaire")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Afficher l'aide du Tribunal")
].map(command => command.toJSON());

const rest = new REST({ version: "10" })
  .setToken(process.env.DISCORD_TOKEN);

async function deploy() {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN est manquant.");
  }

  if (!process.env.CLIENT_ID) {
    throw new Error("CLIENT_ID est manquant.");
  }

  if (!process.env.GUILD_ID) {
    throw new Error("GUILD_ID est manquant.");
  }

  console.log("⚖️ Enregistrement des commandes...");

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    {
      body: commands
    }
  );

  console.log(`✅ ${commands.length} commandes enregistrées.`);
}

deploy().catch(error => {
  console.error("❌ Erreur lors de l'enregistrement :", error);
});  // ==========================

  new SlashCommandBuilder()
    .setName("plaintes")
    .setDescription("Voir toutes les plaintes"),

  // ==========================
  // ⚖️ AUDIENCE
  // ==========================

  new SlashCommandBuilder()
    .setName("audience")
    .setDescription("Ouvrir une audience")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  // ==========================
  // 🔨 CONDAMNER
  // ==========================

  new SlashCommandBuilder()
    .setName("condamner")
    .setDescription("Déclarer un accusé coupable")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("peine")
        .setDescription("Peine prononcée")
        .setRequired(true)
    ),

  // ==========================
  // ✅ ACQUITTER
  // ==========================

  new SlashCommandBuilder()
    .setName("acquitter")
    .setDescription("Déclarer un accusé non coupable")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("raison")
        .setDescription("Raison de l'acquittement")
        .setRequired(true)
    ),

  // ==========================
  // 📜 VERDICT
  // ==========================

  new SlashCommandBuilder()
    .setName("verdict")
    .setDescription("Consulter le verdict")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  // ==========================
  // 🔒 FERMER
  // ==========================

  new SlashCommandBuilder()
    .setName("fermer")
    .setDescription("Fermer une affaire")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  // ==========================
  // ❓ AIDE
  // ==========================

  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Afficher l'aide du Tribunal")

].map(command => command.toJSON());


// ==========================
// DISCORD API
// ==========================

const rest = new REST({ version: "10" })
  .setToken(process.env.DISCORD_TOKEN);


// ==========================
// ENREGISTREMENT
// ==========================

async function deploy() {

  if (!process.env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN est manquant.");
  }

  if (!process.env.CLIENT_ID) {
    throw new Error("CLIENT_ID est manquant.");
  }

  if (!process.env.GUILD_ID) {
    throw new Error("GUILD_ID est manquant.");
  }

  console.log("⚖️ Enregistrement des commandes...");

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    {
      body: commands
    }
  );

  console.log(`✅ ${commands.length} commandes enregistrées.`);
}

deploy().catch(error => {
  console.error("❌ Erreur lors de l'enregistrement :", error);
});
  // ==========================
  // ✅ ACQUITTER
  // ==========================

  new SlashCommandBuilder()
    .setName("acquitter")
    .setDescription("Déclarer un accusé non coupable")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("raison")
        .setDescription("Raison de l'acquittement")
        .setRequired(true)
    ),

  // ==========================
  // 📜 VERDICT
  // ==========================

  new SlashCommandBuilder()
    .setName("verdict")
    .setDescription("Consulter le verdict")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  // ==========================
  // 🔒 FERMER
  // ==========================

  new SlashCommandBuilder()
    .setName("fermer")
    .setDescription("Fermer une affaire")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  // ==========================
  // ❓ AIDE
  // ==========================

  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Afficher l'aide du Tribunal")

].map(command => command.toJSON());


// ==========================
// DISCORD API
// ==========================

const rest = new REST({ version: "10" })
  .setToken(process.env.DISCORD_TOKEN);


// ==========================
// ENREGISTREMENT
// ==========================

async function deploy() {

  if (!process.env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN est manquant.");
  }

  if (!process.env.CLIENT_ID) {
    throw new Error("CLIENT_ID est manquant.");
  }

  if (!process.env.GUILD_ID) {
    throw new Error("GUILD_ID est manquant.");
  }

  console.log("⚖️ Enregistrement des commandes...");

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    {
      body: commands
    }
  );

  console.log(`✅ ${commands.length} commandes enregistrées.`);
}

deploy().catch(error => {
  console.error("❌ Erreur lors de l'enregistrement :", error);
});
