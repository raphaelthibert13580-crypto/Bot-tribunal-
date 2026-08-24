const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const commands = [

  // ==========================
  // /plainte
  // ==========================

  new SlashCommandBuilder()
    .setName("plainte")
    .setDescription("Déposer une plainte")
    .addUserOption(option =>
      option
        .setName("accuse")
        .setDescription("La personne accusée")
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

  // ==========================
  // /plaintes
  // ==========================

  new SlashCommandBuilder()
    .setName("plaintes")
    .setDescription("Voir les plaintes - Juge uniquement"),

  // ==========================
  // /audience
  // ==========================

  new SlashCommandBuilder()
    .setName("audience")
    .setDescription("Ouvrir une audience - Juge uniquement")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  // ==========================
  // /condamner
  // ==========================

  new SlashCommandBuilder()
    .setName("condamner")
    .setDescription("Condamner un accusé - Juge uniquement")
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
  // /acquitter
  // ==========================

  new SlashCommandBuilder()
    .setName("acquitter")
    .setDescription("Acquitter un accusé - Juge uniquement")
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
  // /verdict
  // ==========================

  new SlashCommandBuilder()
    .setName("verdict")
    .setDescription("Consulter le verdict d'une affaire")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  // ==========================
  // /fermer
  // ==========================

  new SlashCommandBuilder()
    .setName("fermer")
    .setDescription("Fermer une affaire - Juge uniquement")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  // ==========================
  // /avocat
  // ==========================

  new SlashCommandBuilder()
    .setName("avocat")
    .setDescription("Choisir un avocat pour son affaire")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName("avocat")
        .setDescription("L'avocat choisi")
        .setRequired(true)
    ),

  // ==========================
  // /representant
  // ==========================

  new SlashCommandBuilder()
    .setName("representant")
    .setDescription("Choisir un représentant de la défense")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName("representant")
        .setDescription("Le représentant choisi")
        .setRequired(true)
    ),

  // ==========================
  // /roles
  // ==========================

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Acheter, équiper ou gérer tes rôles"),

  // ==========================
  // /aide
  // ==========================

  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Afficher l'aide du Tribunal")

].map(command => command.toJSON());


// ==========================
// VÉRIFICATIONS
// ==========================

if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN est manquant.");
}

if (!process.env.CLIENT_ID) {
  throw new Error("CLIENT_ID est manquant.");
}

if (!process.env.GUILD_ID) {
  throw new Error("GUILD_ID est manquant.");
}


// ==========================
// DISCORD REST
// ==========================

const rest = new REST({ version: "10" })
  .setToken(process.env.DISCORD_TOKEN);


// ==========================
// ENREGISTREMENT
// ==========================

async function deploy() {

  console.log("⚖️ Enregistrement des commandes...");

  try {

    const result = await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(
      `✅ ${result.length} commandes enregistrées.`
    );

    console.log(
      "📋 Commandes :",
      result.map(command => `/${command.name}`).join(", ")
    );

  } catch (error) {

    console.error(
      "❌ Erreur lors de l'enregistrement des commandes :",
      error
    );

    process.exit(1);
  }
}

deploy();
