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
  SlashCommandBuilder
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
// PLAINTES
// ======================================================

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]", "utf8");
      return [];
    }

    const content = fs.readFileSync(DATA_FILE, "utf8");

    if (!content.trim()) return [];

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
// RÔLES ACHETÉS
// ======================================================

function loadRolesData() {
  try {
    if (!fs.existsSync(ROLES_FILE)) {
      fs.writeFileSync(ROLES_FILE, "{}", "utf8");
      return {};
    }

    const content = fs.readFileSync(ROLES_FILE, "utf8");

    if (!content.trim()) return {};

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

function getUserOwnedRoles(userId) {
  if (!rolesData[userId]) {
    rolesData[userId] = {
      achetes: [],
      dernier_equipement: 0
    };
    saveRolesData(rolesData);
  }

  if (!Array.isArray(rolesData[userId].achetes)) {
    rolesData[userId].achetes = [];
  }

  if (typeof rolesData[userId].dernier_equipement !== "number") {
    rolesData[userId].dernier_equipement = 0;
  }

  return rolesData[userId].achetes;
}

function hasPurchasedRole(userId, roleName) {
  return getUserOwnedRoles(userId).includes(roleName);
}

function addPurchasedRole(userId, roleName) {
  const roles = getUserOwnedRoles(userId);

  if (!roles.includes(roleName)) {
    roles.push(roleName);
    saveRolesData(rolesData);
  }
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
// NOMS DES RÔLES
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
// OUTILS
// ======================================================

function getRole(guild, name) {
  return guild.roles.cache.find(
    role => role.name === name
  );
}

function nextId() {
  if (plaintes.length === 0) return 1;

  return (
    Math.max(
      ...plaintes.map(p => Number(p.id) || 0)
    ) + 1
  );
}

function getPlainte(id) {
  return plaintes.find(
    p => Number(p.id) === Number(id)
  );
}

function estJuge(member) {
  return member.roles.cache.some(
    role => role.name === ROLE_JUGE
  );
}

function estAvocat(member) {
  return member.roles.cache.some(
    role => role.name === ROLE_AVOCAT
  );
}

function estRepresentant(member) {
  return member.roles.cache.some(
    role => role.name === ROLE_REPRESENTANT
  );
}

function estQOD(member) {
  return member.roles.cache.some(
    role => role.name === ROLE_QOD
  );
               }// ======================================================
// UNBELIEVABOAT
// ======================================================

async function modifierArgent(userId, montant, raison) {
  try {
    const response = await fetch(
      `https://unbelievaboat.com/api/v1/guilds/${GUILD_ID}/users/${userId}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": UNBELIEVABOAT_TOKEN,
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
          "Authorization": UNBELIEVABOAT_TOKEN
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

  const plaignant = await guild.members
    .fetch(plainte.plaignant)
    .catch(() => null);

  const accuse = await guild.members
    .fetch(plainte.accuse)
    .catch(() => null);

  const avocat = plainte.avocat
    ? await guild.members
        .fetch(plainte.avocat)
        .catch(() => null)
    : null;

  const representant = plainte.representant
    ? await guild.members
        .fetch(plainte.representant)
        .catch(() => null)
    : null;

  if (condamne) {
    // PLAIGNANT
    if (plaignant) {
      if (estQOD(plaignant)) {
        const ok = await modifierArgent(
          plainte.plaignant,
          QOD_GAIN,
          `Affaire #${plainte.id} - Quitte ou double gagné`
        );

        if (ok) {
          recompenses.push(
            `🎲 <@${plainte.plaignant}> — **+20 000**`
          );
        }
      } else {
        const ok = await modifierArgent(
          plainte.plaignant,
          RECOMPENSE_PLAIGNANT,
          `Affaire #${plainte.id} - Procès gagné`
        );

        if (ok) {
          recompenses.push(
            `👤 <@${plainte.plaignant}> — **+10 000**`
          );
        }
      }
    }

    // REPRÉSENTANT
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

    // ACCUSÉ QOD
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
    // ACCUSÉ
    if (accuse) {
      if (estQOD(accuse)) {
        const ok = await modifierArgent(
          plainte.accuse,
          QOD_GAIN,
          `Affaire #${plainte.id} - Quitte ou double gagné`
        );

        if (ok) {
          recompenses.push(
            `🎲 <@${plainte.accuse}> — **+20 000**`
          );
        }
      } else {
        const ok = await modifierArgent(
          plainte.accuse,
          RECOMPENSE_ACCUSE_ACQUITTE,
          `Affaire #${plainte.id} - Accusé acquitté`
        );

        if (ok) {
          recompenses.push(
            `⚠️ <@${plainte.accuse}> — **+10 000**`
          );
        }
      }
    }

    // AVOCAT
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

    // PLAIGNANT QOD
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
// CHOIX AUTOMATIQUE
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
            Math.floor(Math.random() * tableau.length)
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
            Math.floor(Math.random() * tableau.length)
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
    }// ======================================================
// CRÉATION DU DOSSIER
// ======================================================

async function creerDossier(guild, plainte) {
  const categorie = guild.channels.cache.find(
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

  const channel = await guild.channels.create({
    name: `📁・affaire-${plainte.id}`,
    type: ChannelType.GuildText,
    parent: categorie ? categorie.id : null,
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
    `⚠️ L'accusé choisit son avocat avec :\n` +
    `\`/avocat id:${plainte.id} avocat:@Nom\`\n\n` +
    `⚠️ Le plaignant choisit son représentant avec :\n` +
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
    .setDescription("Voir les affaires"),

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
    )  ,

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
            name: "🧑‍💼 Avocat — 500 000",
            value: ROLE_AVOCAT
          },
          {
            name: "🛡️ Représentant — 750 000",
            value: ROLE_REPRESENTANT
          },
          {
            name: "🎲 Quitte ou double — 500 000",
            value: ROLE_QOD
          },
          {
            name: "👨‍⚖️ Juge — 5 000 000",
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
            name: "🧑‍💼 Avocat",
            value: ROLE_AVOCAT
          },
          {
            name: "🛡️ Représentant",
            value: ROLE_REPRESENTANT
          },
          {
            name: "🎲 Quitte ou double",
            value: ROLE_QOD
          },
          {
            name: "👨‍⚖️ Juge",
            value: ROLE_JUGE
          }
        )
    ),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Voir les rôles achetés"),

  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Afficher l'aide du Tribunal")
].map(command => command.toJSON());

// ======================================================
// READY
// ======================================================

client.once(Events.ClientReady, readyClient => {
  console.log(
    `✅ Tribunal connecté en tant que ${readyClient.user.tag}`
  );
});

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  Events.InteractionCreate,
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {

      const guild = interaction.guild;

      if (!guild) {
        return interaction.reply({
          content: "❌ Cette commande doit être utilisée sur le serveur.",
          ephemeral: true
        });
      }

      const member = await guild.members
        .fetch(interaction.user.id)
        .catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "❌ Impossible de récupérer ton profil.",
          ephemeral: true
        });
      }

      // ==================================================
      // PLAINTE
      // ==================================================

      if (interaction.commandName === "plainte") {

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
              "❌ L'accusé n'est pas présent sur le serveur.",
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
          juge: null,
          statut: "En attente",
          channel_id: null,
          recompenses_distribuees: false,
          date: new Date().toISOString()
        };

        plaintes.push(plainte);
        saveData(plaintes);

        await interaction.reply({
          content:
            `✅ **Plainte #${id} enregistrée !**\n` +
            `⚠️ Accusé : <@${accuse.id}>`,
          ephemeral: true
        });

        try {
          await creerDossier(guild, plainte);
        } catch (error) {
          console.error(
            "❌ Erreur création dossier :",
            error
          );
        }

        return;
      }

      // ==================================================
      // PLAINTES
      // ==================================================

      if (interaction.commandName === "plaintes") {

        if (!estJuge(member)) {
          return interaction.reply({
            content:
              "❌ Seuls les Juges peuvent consulter les affaires.",
            ephemeral: true
          });
        }

        const ouvertes =
          plaintes.filter(
            p => p.statut !== "Fermée"
          );

        if (ouvertes.length === 0) {
          return interaction.reply({
            content:
              "📂 Aucune affaire ouverte.",
            ephemeral: true
          });
        }

        const texte = ouvertes
          .map(p =>
            `⚖️ **#${p.id}** — <@${p.plaignant}> contre <@${p.accuse}>\n` +
            `📌 ${p.motif}\n` +
            `📊 Statut : **${p.statut}**`
          )
          .join("\n\n");

        return interaction.reply({
          content:
            `📂 **AFFAIRES EN COURS**\n\n${texte}`,
          ephemeral: true
        });
      }

      // ==================================================
      // AVOCAT
      // ==================================================

      if (interaction.commandName === "avocat") {

        const id =
          interaction.options.getInteger("id");

        const avocat =
          interaction.options.getUser("avocat");

        const plainte = getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (plainte.statut === "Fermée") {
          return interaction.reply({
            content:
              "❌ Cette affaire est fermée.",
            ephemeral: true
          });
        }

        if (interaction.user.id !== plainte.accuse) {
          return interaction.reply({
            content:
              "❌ Seul l'accusé peut choisir son avocat.",
            ephemeral: true
          });
        }

        const avocatMember =
          await guild.members
            .fetch(avocat.id)
            .catch(() => null);

        if (!avocatMember || !estAvocat(avocatMember)) {
          return interaction.reply({
            content:
              "❌ Cette personne ne possède pas le rôle Avocat.",
            ephemeral: true
          });
        }

        if (
          avocat.id === plainte.accuse ||
          avocat.id === plainte.plaignant
        ) {
          return interaction.reply({
            content:
              "❌ Cette personne ne peut pas être avocat dans cette affaire.",
            ephemeral: true
          });
        }

        plainte.avocat = avocat.id;
        saveData(plaintes);

        return interaction.reply({
          content:
            `✅ <@${avocat.id}> est maintenant l'avocat de l'accusé.`,
          ephemeral: false
        });
      }

      // ==================================================
      // REPRESENTANT
      // ==================================================

      if (interaction.commandName === "representant") {

        const id =
          interaction.options.getInteger("id");

        const representant =
          interaction.options.getUser("representant");

        const plainte = getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (plainte.statut === "Fermée") {
          return interaction.reply({
            content:
              "❌ Cette affaire est fermée.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !==
          plainte.plaignant
        ) {
          return interaction.reply({
            content:
              "❌ Seul le plaignant peut choisir son représentant.",
            ephemeral: true
          });
        }

        const repMember =
          await guild.members
            .fetch(representant.id)
            .catch(() => null);

        if (
          !repMember ||
          !estRepresentant(repMember)
        ) {
          return interaction.reply({
            content:
              "❌ Cette personne ne possède pas le rôle Représentant de la défense.",
            ephemeral: true
          });
        }

        if (
          representant.id === plainte.accuse ||
          representant.id === plainte.plaignant
        ) {
          return interaction.reply({
            content:
              "❌ Cette personne ne peut pas être représentant dans cette affaire.",
            ephemeral: true
          });
        }

        plainte.representant =
          representant.id;

        saveData(plaintes);

        return interaction.reply({
          content:
            `✅ <@${representant.id}> est maintenant le représentant du plaignant.`,
          ephemeral: false
        });
                 }      // ==================================================
      // CONDAMNER
      // ==================================================

      if (interaction.commandName === "condamner") {

        if (!estJuge(member)) {
          return interaction.reply({
            content:
              "❌ Seuls les Juges peuvent rendre un verdict.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger("id");

        const plainte = getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (plainte.statut === "Fermée") {
          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
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

        return interaction.reply({
          content:
            `🔴 **AFFAIRE #${id} — CONDAMNATION**\n\n` +
            `👨‍⚖️ Juge : <@${interaction.user.id}>\n` +
            `⚠️ Accusé : <@${plainte.accuse}>\n\n` +
            `💰 **Récompenses :**\n` +
            (
              recompenses.length > 0
                ? recompenses.join("\n")
                : "Aucune récompense distribuée."
            )
        });
      }

      // ==================================================
      // ACQUITTER
      // ==================================================

      if (interaction.commandName === "acquitter") {

        if (!estJuge(member)) {
          return interaction.reply({
            content:
              "❌ Seuls les Juges peuvent rendre un verdict.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger("id");

        const plainte = getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        if (plainte.statut === "Fermée") {
          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
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

        return interaction.reply({
          content:
            `🟢 **AFFAIRE #${id} — ACQUITTEMENT**\n\n` +
            `👨‍⚖️ Juge : <@${interaction.user.id}>\n` +
            `⚠️ Accusé : <@${plainte.accuse}>\n\n` +
            `💰 **Récompenses :**\n` +
            (
              recompenses.length > 0
                ? recompenses.join("\n")
                : "Aucune récompense distribuée."
            )
        });
      }

      // ==================================================
      // FERMER
      // ==================================================

      if (interaction.commandName === "fermer") {

        if (!estJuge(member)) {
          return interaction.reply({
            content:
              "❌ Seuls les Juges peuvent fermer une affaire.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger("id");

        const plainte = getPlainte(id);

        if (!plainte) {
          return interaction.reply({
            content:
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }

        plainte.statut = "Fermée";

        saveData(plaintes);

        const channel =
          plainte.channel_id
            ? guild.channels.cache.get(
                plainte.channel_id
              )
            : null;

        if (channel) {
          await channel.send(
            `🔒 **AFFAIRE #${id} FERMÉE**\n\n` +
            `👨‍⚖️ Fermée par <@${interaction.user.id}>.`
          );
        }

        return interaction.reply({
          content:
            `🔒 L'affaire **#${id}** a été fermée.`,
          ephemeral: false
        });
      }

      // ==================================================
      // ACHETER
      // ==================================================

      if (interaction.commandName === "acheter") {

        const roleName =
          interaction.options.getString("role");

        const role =
          getRole(guild, roleName);

        if (!role) {
          return interaction.reply({
            content:
              `❌ Le rôle **${roleName}** n'existe pas sur le serveur.`,
            ephemeral: true
          });
        }

        if (hasPurchasedRole(
          interaction.user.id,
          roleName
        )) {
          return interaction.reply({
            content:
              `❌ Tu possèdes déjà définitivement le rôle **${roleName}**.`,
            ephemeral: true
          });
        }

        const prix = PRIX_ROLES[roleName];

        const argent =
          await getCash(
            interaction.user.id
          );

        if (argent === null) {
          return interaction.reply({
            content:
              "❌ Impossible de récupérer ton argent UnbelievaBoat.",
            ephemeral: true
          });
        }

        if (argent < prix) {
          return interaction.reply({
            content:
              `❌ Tu n'as pas assez d'argent.\n` +
              `💰 Prix : **${prix.toLocaleString("fr-FR")}**\n` +
              `💵 Ton argent : **${argent.toLocaleString("fr-FR")}**`,
            ephemeral: true
          });
        }

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

        addPurchasedRole(
          interaction.user.id,
          roleName
        );

        return interaction.reply({
          content:
            `✅ **Achat effectué !**\n\n` +
            `🎫 Rôle : **${roleName}**\n` +
            `💰 Prix : **${prix.toLocaleString("fr-FR")}**\n\n` +
            `⚠️ Le rôle est maintenant **définitivement à toi**.\n` +
            `Utilise \`/equiper role:${roleName}\` pour l'équiper.`,
          ephemeral: true
        });
      }

      // ==================================================
      // EQUIPER
      // ==================================================

      if (interaction.commandName === "equiper") {

        const roleName =
          interaction.options.getString("role");

        const role =
          getRole(guild, roleName);

        if (!role) {
          return interaction.reply({
            content:
              `❌ Le rôle **${roleName}** n'existe pas.`,
            ephemeral: true
          });
        }

        if (
          !hasPurchasedRole(
            interaction.user.id,
            roleName
          )
        ) {
          return interaction.reply({
            content:
              `❌ Tu n'as jamais acheté le rôle **${roleName}**.`,
            ephemeral: true
          });
        }

        if (
          role.position >=
          guild.members.me.roles.highest.position
        ) {
          return interaction.reply({
            content:
              `❌ Impossible de donner ce rôle : le rôle **${roleName}** est placé au-dessus du rôle du bot Tribunal.\n\n` +
              `➡️ Dans les paramètres Discord, place le rôle **Tribunal au-dessus de ${roleName}**.`,
            ephemeral: true
          });
        }

        if (roleName === ROLE_JUGE) {
          // Pas de blocage : les Juges peuvent acheter/équiper.
        }

        const userData =
          rolesData[interaction.user.id] || {
            achetes: [],
            dernier_equipement: 0
          };

        const maintenant = Date.now();
        const dernier =
          Number(
            userData.dernier_equipement || 0
          );

        const vingtQuatreHeures =
          24 * 60 * 60 * 1000;

        if (
          dernier > 0 &&
          maintenant - dernier <
            vingtQuatreHeures
        ) {
          const restant =
            vingtQuatreHeures -
            (maintenant - dernier);

          const heures =
            Math.floor(
              restant / 3600000
            );

          const minutes =
            Math.floor(
              (restant % 3600000) / 60000
            );

          return interaction.reply({
            content:
              `⏳ Tu dois attendre encore **${heures}h ${minutes}min** avant de changer de rôle.`,
            ephemeral: true
          });
        }

        // Retirer les rôles achetables actuellement équipés
        for (const nomRole of Object.keys(
          PRIX_ROLES
        )) {
          const ancienRole =
            getRole(guild, nomRole);

          if (
            ancienRole &&
            member.roles.cache.has(
              ancienRole.id
            )
          ) {
            await member.roles
              .remove(ancienRole)
              .catch(error => {
                console.error(
                  "❌ Erreur retrait rôle :",
                  error
                );
              });
          }
        }

        // Donner le nouveau rôle
        try {
          await member.roles.add(role);
        } catch (error) {
          console.error(
            "❌ Erreur ajout rôle :",
            error
          );

          return interaction.reply({
            content:
              "❌ Impossible de donner le rôle. Vérifie que le rôle **Tribunal** est placé au-dessus du rôle à équiper.",
            ephemeral: true
          });
        }

        rolesData[interaction.user.id] = {
          achetes:
            getUserOwnedRoles(
              interaction.user.id
            ),
          dernier_equipement: maintenant
        };

        saveRolesData(rolesData);

        return interaction.reply({
          content:
            `✅ Tu as équipé le rôle **${roleName}** !\n\n` +
            `⏳ Tu pourras changer de rôle dans **24 heures**.`,
          ephemeral: true
        });
      }

      // ==================================================
      // VOIR SES RÔLES
      // ==================================================

      if (interaction.commandName === "roles") {

        const roles =
          getUserOwnedRoles(
            interaction.user.id
          );

        if (roles.length === 0) {
          return interaction.reply({
            content:
              "🎫 Tu ne possèdes encore aucun rôle acheté.",
            ephemeral: true
          });
        }

        const liste =
          roles
            .map(role => `• ${role}`)
            .join("\n");

        return interaction.reply({
          content:
            `🎫 **TES RÔLES ACHETÉS**\n\n${liste}\n\n` +
            `⚠️ Ces rôles sont définitivement possédés.\n` +
            `Utilise \`/equiper\` pour en équiper un.`,
          ephemeral: true
        });
      }

      // ==================================================
      // AIDE
      // ==================================================

      if (interaction.commandName === "aide") {

        return interaction.reply({
          content:
            `⚖️ **TRIBUNAL — AIDE**\n\n` +
            `📝 \`/plainte\` — Déposer une plainte.\n` +
            `📋 \`/plaintes\` — Voir les affaires.\n` +
            `🧑‍💼 \`/avocat\` — Choisir un avocat.\n` +
            `🛡️ \`/representant\` — Choisir un représentant.\n` +
            `🔴 \`/condamner\` — Condamner.\n` +
            `🟢 \`/acquitter\` — Acquitter.\n` +
            `🔒 \`/fermer\` — Fermer une affaire.\n` +
            `🛒 \`/acheter\` — Acheter un rôle.\n` +
            `🎫 \`/roles\` — Voir ses rôles.\n` +
            `🎯 \`/equiper\` — Équiper un rôle acheté.\n\n` +
            `⏳ L'équipement est limité à **1 changement toutes les 24 h**.\n` +
            `⚖️ Les Juges peuvent également porter plainte et être accusés.`,
          ephemeral: true
        });
      }

    } catch (error) {

      console.error(
        "❌ Erreur interaction :",
        error
      );

      if (!interaction.replied &&
          !interaction.deferred) {

        await interaction.reply({
          content:
            "❌ Une erreur est survenue. Consulte les logs du bot.",
          ephemeral: true
        }).catch(() => {});
      }
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
