require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ======================================================
// CONFIGURATION
// ======================================================

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const UNBELIEVABOAT_TOKEN = process.env.UNBELIEVABOAT_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN manquant.");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ GUILD_ID manquant.");
  process.exit(1);
}

if (!UNBELIEVABOAT_TOKEN) {
  console.error("❌ UNBELIEVABOAT_TOKEN manquant.");
  process.exit(1);
}

// ======================================================
// FICHIERS
// ======================================================

const DATA_DIR = process.env.DATA_DIR || ".";

const DATA_FILE = path.join(DATA_DIR, "plaintes.json");
const ROLES_FILE = path.join(DATA_DIR, "roles.json");

if (!fs.existsSync(DATA_DIR) && DATA_DIR !== ".") {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ======================================================
// DONNÉES DES PLAINTES
// ======================================================

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]", "utf8");
      return [];
    }

    const content = fs.readFileSync(DATA_FILE, "utf8");

    if (!content.trim()) {
      return [];
    }

    return JSON.parse(content);

  } catch (error) {
    console.error("❌ Erreur chargement plaintes :", error);
    return [];
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("❌ Erreur sauvegarde plaintes :", error);
  }
}

let plaintes = loadData();

// ======================================================
// DONNÉES DES RÔLES ACHETÉS
// ======================================================

function loadRolesData() {
  try {
    if (!fs.existsSync(ROLES_FILE)) {
      fs.writeFileSync(ROLES_FILE, "{}", "utf8");
      return {};
    }

    const content = fs.readFileSync(ROLES_FILE, "utf8");

    if (!content.trim()) {
      return {};
    }

    return JSON.parse(content);

  } catch (error) {
    console.error("❌ Erreur chargement rôles :", error);
    return {};
  }
}

function saveRolesData(data) {
  try {
    fs.writeFileSync(
      ROLES_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("❌ Erreur sauvegarde rôles :", error);
  }
}

let rolesData = loadRolesData();

function getUserRolesData(userId) {
  if (!rolesData[userId]) {
    rolesData[userId] = {
      achetes: [],
      dernierEquipement: 0
    };

    saveRolesData(rolesData);
  }

  if (!Array.isArray(rolesData[userId].achetes)) {
    rolesData[userId].achetes = [];
  }

  if (
    typeof rolesData[userId].dernierEquipement !== "number"
  ) {
    rolesData[userId].dernierEquipement = 0;
  }

  return rolesData[userId];
}

function getUserOwnedRoles(userId) {
  return getUserRolesData(userId).achetes;
}

function hasPurchasedRole(userId, roleName) {
  return getUserOwnedRoles(userId).includes(roleName);
}

function addPurchasedRole(userId, roleName) {
  const userData = getUserRolesData(userId);

  if (!userData.achetes.includes(roleName)) {
    userData.achetes.push(roleName);
    saveRolesData(rolesData);
  }
}

function canEquipRole(userId) {
  const userData = getUserRolesData(userId);
  const now = Date.now();
  const delay = 24 * 60 * 60 * 1000;

  return now - userData.dernierEquipement >= delay;
}

function getRemainingEquipTime(userId) {
  const userData = getUserRolesData(userId);
  const delay = 24 * 60 * 60 * 1000;

  return Math.max(
    0,
    delay - (Date.now() - userData.dernierEquipement)
  );
}

function setRoleEquippedNow(userId) {
  const userData = getUserRolesData(userId);

  userData.dernierEquipement = Date.now();

  saveRolesData(rolesData);
}

// ======================================================
// CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ======================================================
// RÔLES
// ======================================================

const ROLE_COUR = "Cour";
const ROLE_JUGE = "Juge";
const ROLE_AVOCAT = "Avocat";
const ROLE_REPRESENTANT = "Représentant de la défense";
const ROLE_QOD = "Quitte ou double";

// ======================================================
// PRIX
// ======================================================

const PRIX_ROLES = {
  [ROLE_AVOCAT]: 500000,
  [ROLE_REPRESENTANT]: 750000,
  [ROLE_QOD]: 500000,
  [ROLE_JUGE]: 5000000
};

// ======================================================
// RÉCOMPENSES
// ======================================================

const RECOMPENSE_PLAIGNANT = 10000;
const RECOMPENSE_REPRESENTANT = 20000;
const RECOMPENSE_ACCUSE_ACQUITTE = 10000;
const RECOMPENSE_AVOCAT_ACQUITTE = 10000;

const QOD_GAIN = 20000;
const QOD_PERTE = -10000;
// ======================================================
// UNBELIEVABOAT
// ======================================================

async function modifierArgent(userId, montant, raison) {
  try {
    const response = await fetch(
      `https://unbelievaboat.com/api/v1/guilds/${GUILD_ID}/users/${userId}`,
      {
        method: "PATCH",

        headers: {
          Authorization: UNBELIEVABOAT_TOKEN,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          cash: montant,
          reason: raison
        })
      }
    );

    if (!response.ok) {
      const texte = await response.text();

      console.error(
        `❌ Erreur UnbelievaBoat (${response.status}) :`,
        texte
      );

      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Erreur connexion UnbelievaBoat :",
      error
    );

    return false;
  }
}

async function getCash(userId) {
  try {
    const response = await fetch(
      `https://unbelievaboat.com/api/v1/guilds/${GUILD_ID}/users/${userId}`,
      {
        headers: {
          Authorization: UNBELIEVABOAT_TOKEN
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    return Number(data.cash || 0);
  } catch (error) {
    console.error(
      "❌ Erreur récupération argent :",
      error
    );

    return null;
  }
}

// ======================================================
// RÉCOMPENSES
// ======================================================

async function donnerRecompenses(plainte, condamne) {
  if (plainte.recompenses_distribuees) {
    console.log(
      `⚠️ Récompenses déjà distribuées pour #${plainte.id}`
    );

    return [];
  }

  const guild = client.guilds.cache.get(GUILD_ID);

  if (!guild) return [];

  const recompenses = [];

  const plaignant =
    await guild.members
      .fetch(plainte.plaignant)
      .catch(() => null);

  const accuse =
    await guild.members
      .fetch(plainte.accuse)
      .catch(() => null);

  const avocat =
    plainte.avocat
      ? await guild.members
          .fetch(plainte.avocat)
          .catch(() => null)
      : null;

  const representant =
    plainte.representant
      ? await guild.members
          .fetch(plainte.representant)
          .catch(() => null)
      : null;

  // ====================================================
  // CONDAMNATION
  // ====================================================

  if (condamne) {

    if (plaignant) {
      const montant =
        estQOD(plaignant)
          ? QOD_GAIN
          : RECOMPENSE_PLAIGNANT;

      const ok = await modifierArgent(
        plainte.plaignant,
        montant,
        `Affaire #${plainte.id} - Procès gagné`
      );

      if (ok) {
        recompenses.push(
          `👤 <@${plainte.plaignant}> — **+${montant.toLocaleString("fr-FR")}**`
        );
      }
    }

    if (representant) {
      const ok = await modifierArgent(
        plainte.representant,
        RECOMPENSE_REPRESENTANT,
        `Affaire #${plainte.id} - Représentant`
      );

      if (ok) {
        recompenses.push(
          `🛡️ <@${plainte.representant}> — **+20 000**`
        );
      }
    }

    if (accuse && estQOD(accuse)) {
      const ok = await modifierArgent(
        plainte.accuse,
        QOD_PERTE,
        `Affaire #${plainte.id} - Quitte ou double perdu`
      );

      if (ok) {
        recompenses.push(
          `🎲 <@${plainte.accuse}> — **-10 000**`
        );
      }
    }

  } else {

    // ==================================================
    // ACQUITTEMENT
    // ==================================================

    if (accuse) {
      const montant =
        estQOD(accuse)
          ? QOD_GAIN
          : RECOMPENSE_ACCUSE_ACQUITTE;

      const ok = await modifierArgent(
        plainte.accuse,
        montant,
        `Affaire #${plainte.id} - Accusé acquitté`
      );

      if (ok) {
        recompenses.push(
          `⚠️ <@${plainte.accuse}> — **+${montant.toLocaleString("fr-FR")}**`
        );
      }
    }

    if (avocat) {
      const ok = await modifierArgent(
        plainte.avocat,
        RECOMPENSE_AVOCAT_ACQUITTE,
        `Affaire #${plainte.id} - Avocat`
      );

      if (ok) {
        recompenses.push(
          `🧑‍💼 <@${plainte.avocat}> — **+10 000**`
        );
      }
    }

    if (plaignant && estQOD(plaignant)) {
      const ok = await modifierArgent(
        plainte.plaignant,
        QOD_PERTE,
        `Affaire #${plainte.id} - Quitte ou double perdu`
      );

      if (ok) {
        recompenses.push(
          `🎲 <@${plainte.plaignant}> — **-10 000**`
        );
      }
    }
  }

  plainte.recompenses_distribuees = true;

  saveData(plaintes);

  return recompenses;
}

// ======================================================
// CHOIX AUTOMATIQUE APRÈS 2 MINUTES
// ======================================================

async function choisirAutomatiquement(guild, plainte) {
  if (plainte.statut === "Fermée") return;

  // AVOCAT
  if (!plainte.avocat) {
    const role = getRole(guild, ROLE_AVOCAT);

    if (role) {
      const candidats = role.members.filter(
        member =>
          member.id !== plainte.accuse &&
          member.id !== plainte.plaignant
      );

      if (candidats.size > 0) {
        const tableau = [...candidats.values()];

        const choisi =
          tableau[
            Math.floor(
              Math.random() * tableau.length
            )
          ];

        plainte.avocat = choisi.id;

        saveData(plaintes);

        const channel =
          guild.channels.cache.get(
            plainte.channel_id
          );

        if (channel) {
          await channel.send(
            `🧑‍💼 **AVOCAT CHOISI AUTOMATIQUEMENT**\n\n` +
            `L'accusé n'ayant pas choisi d'avocat dans les **2 minutes**, ` +
            `${choisi} a été désigné aléatoirement.`
          );
        }
      }
    }
  }

  // REPRÉSENTANT
  if (!plainte.representant) {
    const role = getRole(
      guild,
      ROLE_REPRESENTANT
    );

    if (role) {
      const candidats = role.members.filter(
        member =>
          member.id !== plainte.accuse &&
          member.id !== plainte.plaignant
      );

      if (candidats.size > 0) {
        const tableau = [...candidats.values()];

        const choisi =
          tableau[
            Math.floor(
              Math.random() * tableau.length
            )
          ];

        plainte.representant = choisi.id;

        saveData(plaintes);

        const channel =
          guild.channels.cache.get(
            plainte.channel_id
          );

        if (channel) {
          await channel.send(
            `🛡️ **REPRÉSENTANT CHOISI AUTOMATIQUEMENT**\n\n` +
            `Le plaignant n'ayant pas choisi de représentant dans les **2 minutes**, ` +
            `${choisi} a été désigné aléatoirement.`
          );
        }
      }
    }
  }

  saveData(plaintes);
}

// ======================================================
// CRÉATION DU DOSSIER
// ======================================================

async function creerDossier(guild, plainte) {
  const categorie =
    guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildCategory &&
        (
          channel.name === "⚖️ TRIBUNAL" ||
          channel.name === "📂 AFFAIRES"
        )
    );

  const jugeRole = getRole(guild, ROLE_JUGE);
  const courRole = getRole(guild, ROLE_COUR);
  const avocatRole = getRole(guild, ROLE_AVOCAT);
  const representantRole =
    getRole(guild, ROLE_REPRESENTANT);

  const permissions = [
    {
      id: guild.roles.everyone.id,

      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id: plainte.plaignant,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    },

    {
      id: plainte.accuse,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  if (jugeRole) {
    permissions.push({
      id: jugeRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  if (courRole) {
    permissions.push({
      id: courRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  if (avocatRole) {
    permissions.push({
      id: avocatRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  if (representantRole) {
    permissions.push({
      id: representantRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const channel =
    await guild.channels.create({
      name: `📁・affaire-${plainte.id}`,

      type: ChannelType.GuildText,

      parent:
        categorie
          ? categorie.id
          : null,

      permissionOverwrites: permissions
    });

  plainte.channel_id = channel.id;

  await channel.send(
    `⚖️ **DOSSIER JUDICIAIRE #${plainte.id}**\n\n` +
    `👤 **Plaignant :** <@${plainte.plaignant}>\n` +
    `⚠️ **Accusé :** <@${plainte.accuse}>\n` +
    `📌 **Motif :** ${plainte.motif}\n` +
    `📄 **Description :** ${plainte.description}\n\n` +
    `⏳ **Statut :** ${plainte.statut}\n\n` +
    `🧑‍💼 **Avocat :** Aucun\n` +
    `🛡️ **Représentant :** Aucun\n\n` +
    `⚠️ L'accusé peut choisir son avocat avec :\n` +
    `\`/avocat id:${plainte.id} avocat:@Nom\`\n\n` +
    `⚠️ Le plaignant peut choisir son représentant avec :\n` +
    `\`/representant id:${plainte.id} representant:@Nom\`\n\n` +
    `⏱️ Après **2 minutes**, le bot tentera de choisir automatiquement.`
  );

  saveData(plaintes);

  setTimeout(async () => {
    try {
      await choisirAutomatiquement(
        guild,
        plainte
      );
    } catch (error) {
      console.error(
        "❌ Erreur choix automatique :",
        error
      );
    }
  }, 2 * 60 * 1000);

  return channel;
    }
// ======================================================
// COMMANDES SLASH
// ======================================================

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
        .setDescription("Description des faits")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("plaintes")
    .setDescription("Voir les plaintes"),

  new SlashCommandBuilder()
    .setName("avocat")
    .setDescription("Choisir un avocat")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName("avocat")
        .setDescription("Avocat choisi")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("representant")
    .setDescription("Choisir un représentant")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName("representant")
        .setDescription("Représentant choisi")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("condamner")
    .setDescription("Condamner un accusé")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Numéro de l'affaire")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("acquitter")
    .setDescription("Acquitter un accusé")
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
    .setName("acheter")
    .setDescription("Acheter un rôle")
    .addStringOption(option =>
      option
        .setName("role")
        .setDescription("Rôle à acheter")
        .setRequired(true)
        .addChoices(
          {
            name: "Avocat — 500 000",
            value: ROLE_AVOCAT
          },
          {
            name: "Représentant — 750 000",
            value: ROLE_REPRESENTANT
          },
          {
            name: "Quitte ou double — 500 000",
            value: ROLE_QOD
          },
          {
            name: "Juge — 5 000 000",
            value: ROLE_JUGE
          }
        )
    ),

  new SlashCommandBuilder()
    .setName("equiper")
    .setDescription("Équiper un rôle acheté")
    .addStringOption(option =>
      option
        .setName("role")
        .setDescription("Rôle à équiper")
        .setRequired(true)
        .addChoices(
          {
            name: "Avocat",
            value: ROLE_AVOCAT
          },
          {
            name: "Représentant",
            value: ROLE_REPRESENTANT
          },
          {
            name: "Quitte ou double",
            value: ROLE_QOD
          },
          {
            name: "Juge",
            value: ROLE_JUGE
          }
        )
    ),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Voir les rôles achetés"),

  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Afficher l'aide")
].map(command => command.toJSON());

// ======================================================
// ENREGISTREMENT DES COMMANDES
// ======================================================

async function enregistrerCommandes() {
  try {
    const rest = new REST({ version: "10" })
      .setToken(TOKEN);

    console.log("⏳ Enregistrement des commandes...");

    await rest.put(
      Routes.applicationGuildCommands(
        client.user.id,
        GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log("✅ Commandes enregistrées.");
  } catch (error) {
    console.error(
      "❌ Erreur enregistrement commandes :",
      error
    );
  }
}

// ======================================================
// VÉRIFICATION D'ACCÈS JUGE
// ======================================================

function verifierJuge(interaction) {
  return estJuge(interaction.member);
}

// ======================================================
// MISE À JOUR DU DOSSIER
// ======================================================

async function actualiserDossier(plainte) {
  const guild = client.guilds.cache.get(GUILD_ID);

  if (!guild || !plainte.channel_id) return;

  const channel =
    guild.channels.cache.get(
      plainte.channel_id
    );

  if (!channel) return;

  const statut =
    plainte.statut || "En cours";

  const avocat =
    plainte.avocat
      ? `<@${plainte.avocat}>`
      : "Aucun";

  const representant =
    plainte.representant
      ? `<@${plainte.representant}>`
      : "Aucun";

  await channel.send(
    `📋 **MISE À JOUR DE L'AFFAIRE #${plainte.id}**\n\n` +
    `👤 Plaignant : <@${plainte.plaignant}>\n` +
    `⚠️ Accusé : <@${plainte.accuse}>\n` +
    `🧑‍💼 Avocat : ${avocat}\n` +
    `🛡️ Représentant : ${representant}\n` +
    `📌 Statut : **${statut}**`
  );
    }
// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  Events.InteractionCreate,
  async interaction => {

    try {

      if (!interaction.isChatInputCommand()) {
        return;
      }

      const guild = interaction.guild;

      if (!guild) {
        return interaction.reply({
          content: "❌ Cette commande doit être utilisée sur le serveur.",
          ephemeral: true
        });
      }

      // ==================================================
      // /PLAINTE
      // ==================================================

      if (interaction.commandName === "plainte") {

        // IMPORTANT :
        // AUCUNE vérification de juge ici.
        // Un juge peut donc porter plainte.
        // Un juge peut également être accusé.

        const accuse =
          interaction.options.getUser("accuse");

        const motif =
          interaction.options.getString("motif");

        const description =
          interaction.options.getString("description");

        if (accuse.id === interaction.user.id) {
          return interaction.reply({
            content:
              "❌ Tu ne peux pas porter plainte contre toi-même.",
            ephemeral: true
          });
        }

        const accuseMember =
          await guild.members
            .fetch(accuse.id)
            .catch(() => null);

        if (!accuseMember) {
          return interaction.reply({
            content:
              "❌ Impossible de trouver l'accusé.",
            ephemeral: true
          });
        }

        const id = nextId();

        const plainte = {
          id,
          plaignant: interaction.user.id,
          accuse: accuse.id,
          motif,
          description,
          avocat: null,
          representant: null,
          channel_id: null,
          statut: "En cours",
          date: Date.now(),
          recompenses_distribuees: false
        };

        plaintes.push(plainte);

        saveData(plaintes);

        await interaction.reply({
          content:
            `⚖️ **Plainte #${id} créée !**\n` +
            `Le dossier judiciaire est en cours de création.`,
          ephemeral: true
        });

        try {

          const channel =
            await creerDossier(
              guild,
              plainte
            );

          await interaction.editReply({
            content:
              `⚖️ **Plainte #${id} créée !**\n` +
              `📁 Dossier : ${channel}`
          });

        } catch (error) {

          console.error(
            "❌ Erreur création dossier :",
            error
          );

          await interaction.editReply({
            content:
              `⚠️ La plainte #${id} a été enregistrée, mais le dossier n'a pas pu être créé.\n` +
              `Vérifie les permissions du bot.`
          });
        }

        return;
      }

      // ==================================================
      // /PLAINTES
      // ==================================================

      if (interaction.commandName === "plaintes") {

        if (!verifierJuge(interaction)) {
          return interaction.reply({
            content:
              "❌ Seul un juge peut utiliser cette commande.",
            ephemeral: true
          });
        }

        if (plaintes.length === 0) {
          return interaction.reply({
            content: "📂 Aucune plainte enregistrée.",
            ephemeral: true
          });
        }

        const liste =
          plaintes
            .slice(-20)
            .reverse()
            .map(p =>
              `**#${p.id}** — <@${p.plaignant}> contre <@${p.accuse}> — **${p.statut}**`
            )
            .join("\n");

        return interaction.reply({
          content:
            `⚖️ **AFFAIRES RÉCENTES**\n\n${liste}`,
          ephemeral: true
        });
      }

      // ==================================================
      // /AVOCAT
      // ==================================================

      if (interaction.commandName === "avocat") {

        const id =
          interaction.options.getInteger("id");

        const avocat =
          interaction.options.getUser("avocat");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (plainte.statut !== "En cours") {
          return interaction.reply({
            content:
              "❌ Cette affaire est déjà terminée.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !==
          plainte.accuse &&
          !verifierJuge(interaction)
        ) {
          return interaction.reply({
            content:
              "❌ Seul l'accusé ou un juge peut choisir l'avocat.",
            ephemeral: true
          });
        }

        const avocatMember =
          await guild.members
            .fetch(avocat.id)
            .catch(() => null);

        if (!avocatMember) {
          return interaction.reply({
            content:
              "❌ Avocat introuvable.",
            ephemeral: true
          });
        }

        if (!estAvocat(avocatMember)) {
          return interaction.reply({
            content:
              "❌ Cette personne n'a pas le rôle **Avocat**.",
            ephemeral: true
          });
        }

        if (
          avocat.id === plainte.accuse ||
          avocat.id === plainte.plaignant
        ) {
          return interaction.reply({
            content:
              "❌ L'avocat ne peut pas être le plaignant ou l'accusé.",
            ephemeral: true
          });
        }

        plainte.avocat = avocat.id;

        saveData(plaintes);

        await actualiserDossier(plainte);

        return interaction.reply({
          content:
            `🧑‍💼 ${avocat} a été désigné comme avocat de l'affaire **#${id}**.`,
          ephemeral: false
        });
      }

      // ==================================================
      // /REPRESENTANT
      // ==================================================

      if (
        interaction.commandName ===
        "representant"
      ) {

        const id =
          interaction.options.getInteger("id");

        const representant =
          interaction.options.getUser(
            "representant"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (plainte.statut !== "En cours") {
          return interaction.reply({
            content:
              "❌ Cette affaire est déjà terminée.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !==
          plainte.plaignant &&
          !verifierJuge(interaction)
        ) {
          return interaction.reply({
            content:
              "❌ Seul le plaignant ou un juge peut choisir le représentant.",
            ephemeral: true
          });
        }

        const membre =
          await guild.members
            .fetch(representant.id)
            .catch(() => null);

        if (!membre) {
          return interaction.reply({
            content:
              "❌ Représentant introuvable.",
            ephemeral: true
          });
        }

        if (!estRepresentant(membre)) {
          return interaction.reply({
            content:
              "❌ Cette personne n'a pas le rôle **Représentant de la défense**.",
            ephemeral: true
          });
        }

        if (
          representant.id === plainte.accuse ||
          representant.id === plainte.plaignant
        ) {
          return interaction.reply({
            content:
              "❌ Le représentant ne peut pas être le plaignant ou l'accusé.",
            ephemeral: true
          });
        }

        plainte.representant =
          representant.id;

        saveData(plaintes);

        await actualiserDossier(plainte);

        return interaction.reply({
          content:
            `🛡️ ${representant} a été désigné représentant pour l'affaire **#${id}**.`,
          ephemeral: false
        });
      }

      // ==================================================
      // /CONDAMNER
      // ==================================================

      if (
        interaction.commandName ===
        "condamner"
      ) {

        if (!verifierJuge(interaction)) {
          return interaction.reply({
            content:
              "❌ Seul un juge peut rendre un verdict.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger("id");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (plainte.statut !== "En cours") {
          return interaction.reply({
            content:
              "❌ Cette affaire est déjà terminée.",
            ephemeral: true
          });
        }

        plainte.statut = "Condamnée";
        plainte.juge = interaction.user.id;

        saveData(plaintes);

        const recompenses =
          await donnerRecompenses(
            plainte,
            true
          );

        await actualiserDossier(plainte);

        return interaction.reply({
          content:
            `⚖️ **Affaire #${id} : ACCUSÉ CONDAMNÉ**\n\n` +
            `💰 **Récompenses :**\n` +
            (
              recompenses.length
                ? recompenses.join("\n")
                : "Aucune récompense distribuée."
            )
        });
      }

      // ==================================================
      // /ACQUITTER
      // ==================================================

      if (
        interaction.commandName ===
        "acquitter"
      ) {

        if (!verifierJuge(interaction)) {
          return interaction.reply({
            content:
              "❌ Seul un juge peut rendre un verdict.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger("id");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (plainte.statut !== "En cours") {
          return interaction.reply({
            content:
              "❌ Cette affaire est déjà terminée.",
            ephemeral: true
          });
        }

        plainte.statut = "Acquittée";
        plainte.juge = interaction.user.id;

        saveData(plaintes);

        const recompenses =
          await donnerRecompenses(
            plainte,
            false
          );

        await actualiserDossier(plainte);

        return interaction.reply({
          content:
            `⚖️ **Affaire #${id} : ACCUSÉ ACQUITTÉ**\n\n` +
            `💰 **Récompenses :**\n` +
            (
              recompenses.length
                ? recompenses.join("\n")
                : "Aucune récompense distribuée."
            )
        });
      }

      // ==================================================
      // /FERMER
      // ==================================================

      if (interaction.commandName === "fermer") {

        if (!verifierJuge(interaction)) {
          return interaction.reply({
            content:
              "❌ Seul un juge peut fermer une affaire.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger("id");

        const plainte =
          getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        plainte.statut = "Fermée";

        saveData(plaintes);

        await actualiserDossier(plainte);

        return interaction.reply({
          content:
            `🔒 L'affaire **#${id}** est maintenant fermée.`
        });
}
            // ==================================================
      // /ACHETER
      // ==================================================

      if (interaction.commandName === "acheter") {

        const roleName =
          interaction.options.getString("role");

        const prix =
          PRIX_ROLES[roleName];

        if (!prix) {
          return interaction.reply({
            content:
              "❌ Ce rôle n'est pas disponible à l'achat.",
            ephemeral: true
          });
        }

        if (
          hasPurchasedRole(
            interaction.user.id,
            roleName
          )
        ) {
          return interaction.reply({
            content:
              `❌ Tu possèdes déjà définitivement le rôle **${roleName}**.\n` +
              `Tu n'as pas besoin de le racheter.`,
            ephemeral: true
          });
        }

        const argent =
          await getCash(
            interaction.user.id
          );

        if (argent === null) {
          return interaction.reply({
            content:
              "❌ Impossible de vérifier ton argent avec UnbelievaBoat.",
            ephemeral: true
          });
        }

        if (argent < prix) {
          return interaction.reply({
            content:
              `❌ Tu n'as pas assez d'argent.\n\n` +
              `💰 Ton argent : **${argent.toLocaleString("fr-FR")}**\n` +
              `💵 Prix : **${prix.toLocaleString("fr-FR")}**`,
            ephemeral: true
          });
        }

        // Retrait du prix
        const paiement =
          await modifierArgent(
            interaction.user.id,
            -prix,
            `Achat du rôle ${roleName}`
          );

        if (!paiement) {
          return interaction.reply({
            content:
              "❌ Le paiement n'a pas pu être effectué.",
            ephemeral: true
          });
        }

        // Le rôle acheté reste définitivement possédé
        addPurchasedRole(
          interaction.user.id,
          roleName
        );

        return interaction.reply({
          content:
            `✅ **Achat effectué !**\n\n` +
            `🎫 Rôle : **${roleName}**\n` +
            `💰 Prix : **${prix.toLocaleString("fr-FR")}**\n\n` +
            `📦 Tu possèdes maintenant définitivement ce rôle.\n` +
            `⚠️ L'achat n'a pas besoin d'être refait.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /EQUIPER
      // ==================================================

      if (interaction.commandName === "equiper") {

        const roleName =
          interaction.options.getString("role");

        if (
          !hasPurchasedRole(
            interaction.user.id,
            roleName
          )
        ) {
          return interaction.reply({
            content:
              `❌ Tu ne possèdes pas le rôle **${roleName}**.\n` +
              `Tu dois d'abord l'acheter avec \`/acheter\`.`,
            ephemeral: true
          });
        }

        if (
          !canEquipRole(
            interaction.user.id
          )
        ) {
          const restant =
            getRemainingEquipTime(
              interaction.user.id
            );

          return interaction.reply({
            content:
              `⏳ Tu dois attendre encore **${formatTemps(restant)}** avant de pouvoir équiper un rôle.\n\n` +
              `💡 Tu possèdes toujours définitivement tes rôles : ` +
              `seul leur **équipement** est limité à 1 fois toutes les 24 h.`,
            ephemeral: true
          });
        }

        const role =
          getRole(
            guild,
            roleName
          );

        if (!role) {
          return interaction.reply({
            content:
              `❌ Le rôle **${roleName}** n'existe pas sur le serveur.`,
            ephemeral: true
          });
        }

        // ==================================================
        // VÉRIFICATION DE LA HIÉRARCHIE DU BOT
        // ==================================================

        const botMember =
          guild.members.me;

        if (!botMember) {
          return interaction.reply({
            content:
              "❌ Impossible de trouver le bot sur le serveur.",
            ephemeral: true
          });
        }

        if (
          role.position >=
          botMember.roles.highest.position
        ) {
          return interaction.reply({
            content:
              `❌ Je ne peux pas donner le rôle **${roleName}** car il est au-dessus ou au même niveau que mon rôle.\n\n` +
              `➡️ Dans les paramètres du serveur, place le rôle **Tribunal** au-dessus de **${roleName}**.`,
            ephemeral: true
          });
        }

        // Retirer les anciens rôles achetés
        // avant d'équiper le nouveau
        const rolesAchetes =
          getUserOwnedRoles(
            interaction.user.id
          );

        for (const ancienRoleName of rolesAchetes) {

          if (
            ancienRoleName === roleName
          ) {
            continue;
          }

          const ancienRole =
            getRole(
              guild,
              ancienRoleName
            );

          if (
            ancienRole &&
            interaction.member.roles.cache.has(
              ancienRole.id
            )
          ) {
            await interaction.member.roles
              .remove(ancienRole)
              .catch(error => {
                console.error(
                  `❌ Impossible de retirer ${ancienRoleName} :`,
                  error
                );
              });
          }
        }

        // Donner le nouveau rôle
        try {

          await interaction.member.roles.add(
            role,
            `Équipement du rôle ${roleName}`
          );

        } catch (error) {

          console.error(
            "❌ Erreur attribution rôle :",
            error
          );

          return interaction.reply({
            content:
              `❌ Impossible de donner le rôle **${roleName}**.\n\n` +
              `Vérifie que le rôle **Tribunal** est placé **au-dessus** du rôle que tu veux équiper.`,
            ephemeral: true
          });
        }

        // Démarrage du délai de 24 h
        setRoleEquippedNow(
          interaction.user.id
        );

        return interaction.reply({
          content:
            `✅ **Rôle équipé !**\n\n` +
            `🎫 **${roleName}** t'a été donné.\n\n` +
            `⏳ Tu pourras changer de rôle dans **24 heures**.\n` +
            `📦 Tu gardes définitivement tous les rôles que tu as achetés.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /ROLES
      // ==================================================

      if (interaction.commandName === "roles") {

        const roles =
          getUserOwnedRoles(
            interaction.user.id
          );

        if (roles.length === 0) {
          return interaction.reply({
            content:
              "📦 Tu ne possèdes encore aucun rôle acheté.",
            ephemeral: true
          });
        }

        const liste =
          roles
            .map(role => `🎫 **${role}**`)
            .join("\n");

        return interaction.reply({
          content:
            `📦 **TES RÔLES POSSÉDÉS DÉFINITIVEMENT**\n\n` +
            `${liste}\n\n` +
            `⚠️ Tu peux équiper un rôle avec \`/equiper\`.\n` +
            `⏳ L'équipement est limité à **1 fois toutes les 24 h**.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /AIDE
      // ==================================================

      if (interaction.commandName === "aide") {

        return interaction.reply({
          content:
            `⚖️ **TRIBUNAL — COMMANDES**\n\n` +

            `📝 \`/plainte\` — Déposer une plainte.\n` +
            `📂 \`/plaintes\` — Voir les affaires (Juge).\n` +
            `🧑‍💼 \`/avocat\` — Choisir un avocat.\n` +
            `🛡️ \`/representant\` — Choisir un représentant.\n` +
            `⚖️ \`/condamner\` — Condamner (Juge).\n` +
            `⚖️ \`/acquitter\` — Acquitter (Juge).\n` +
            `🔒 \`/fermer\` — Fermer une affaire (Juge).\n\n` +

            `🛒 \`/acheter\` — Acheter un rôle.\n` +
            `🎫 \`/equiper\` — Équiper un rôle acheté.\n` +
            `📦 \`/roles\` — Voir ses rôles achetés.\n\n` +

            `⏳ Les rôles achetés sont **définitifs**.\n` +
            `🔄 L'équipement d'un rôle est limité à **1 fois toutes les 24 h**.\n\n` +

            `⚠️ **Important :** les Juges peuvent eux aussi utiliser \`/plainte\` et peuvent être accusés.`
        });
      }

    } catch (error) {

      console.error(
        "❌ Erreur interaction :",
        error
      );

      if (interaction.replied || interaction.deferred) {

        await interaction.followUp({
          content:
            "❌ Une erreur est survenue.",
          ephemeral: true
        }).catch(() => {});

      } else {

        await interaction.reply({
          content:
            "❌ Une erreur est survenue.",
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
);

// ======================================================
// DÉMARRAGE DU BOT
// ======================================================

client.once(
  Events.ClientReady,
  async readyClient => {

    console.log(
      `✅ Tribunal connecté en tant que ${readyClient.user.tag}`
    );

    console.log(
      `🏛️ Serveur configuré : ${GUILD_ID}`
    );

    try {
      await enregistrerCommandes();
    } catch (error) {
      console.error(
        "❌ Erreur initialisation commandes :",
        error
      );
    }
  }
);

// ======================================================
// CONNEXION
// ======================================================

client.login(TOKEN).catch(error => {

  console.error(
    "❌ Impossible de connecter le bot :",
    error
  );

});
