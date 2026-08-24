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
const UNBELIEVABOAT_TOKEN =
  process.env.UNBELIEVABOAT_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN manquant.");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ GUILD_ID manquant.");
  process.exit(1);
}

if (!UNBELIEVABOAT_TOKEN) {
  console.error(
    "❌ UNBELIEVABOAT_TOKEN manquant."
  );
  process.exit(1);
}

// ======================================================
// FICHIERS
// ======================================================

const DATA_DIR =
  process.env.DATA_DIR || ".";

const DATA_FILE =
  path.join(
    DATA_DIR,
    "plaintes.json"
  );

const ROLES_FILE =
  path.join(
    DATA_DIR,
    "roles.json"
  );

if (
  !fs.existsSync(DATA_DIR) &&
  DATA_DIR !== "."
) {
  fs.mkdirSync(
    DATA_DIR,
    {
      recursive: true
    }
  );
}

// ======================================================
// OUTILS JSON
// ======================================================

function loadJSON(
  file,
  defaultValue
) {
  try {

    if (!fs.existsSync(file)) {

      fs.writeFileSync(
        file,
        JSON.stringify(
          defaultValue,
          null,
          2
        ),
        "utf8"
      );

      return defaultValue;
    }

    const content =
      fs.readFileSync(
        file,
        "utf8"
      );

    if (!content.trim()) {
      return defaultValue;
    }

    return JSON.parse(content);

  } catch (error) {

    console.error(
      `❌ Erreur lecture ${file} :`,
      error
    );

    return defaultValue;
  }
}

function saveJSON(
  file,
  data
) {
  try {

    fs.writeFileSync(
      file,
      JSON.stringify(
        data,
        null,
        2
      ),
      "utf8"
    );

  } catch (error) {

    console.error(
      `❌ Erreur sauvegarde ${file} :`,
      error
    );
  }
}

// ======================================================
// DONNÉES
// ======================================================

let plaintes =
  loadJSON(
    DATA_FILE,
    []
  );

let rolesData =
  loadJSON(
    ROLES_FILE,
    {}
  );

// ======================================================
// CLIENT
// ======================================================

const client =
  new Client({

    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers
    ]

  });

// ======================================================
// RÔLES
// ======================================================

const ROLE_COUR =
  "Cour";

const ROLE_JUGE =
  "Juge";

const ROLE_AVOCAT =
  "Avocat";

const ROLE_REPRESENTANT =
  "Représentant de la défense";

const ROLE_QOD =
  "Quitte ou double";

// ======================================================
// PRIX
// ======================================================

const PRIX_ROLES = {

  [ROLE_AVOCAT]:
    500000,

  [ROLE_REPRESENTANT]:
    750000,

  [ROLE_QOD]:
    500000,

  [ROLE_JUGE]:
    5000000

};

// ======================================================
// RÉCOMPENSES
// ======================================================

const RECOMPENSE_PLAIGNANT =
  10000;

const RECOMPENSE_REPRESENTANT =
  20000;

const RECOMPENSE_ACCUSE_ACQUITTE =
  10000;

const RECOMPENSE_AVOCAT_ACQUITTE =
  10000;

const QOD_GAIN =
  20000;

const QOD_PERTE =
  -10000;

// ======================================================
// FONCTIONS DE BASE
// ======================================================

function nextId() {

  if (
    plaintes.length === 0
  ) {
    return 1;
  }

  return (
    Math.max(
      ...plaintes.map(
        p => Number(p.id) || 0
      )
    ) + 1
  );
}

function getPlainte(id) {

  return plaintes.find(
    p =>
      Number(p.id) ===
      Number(id)
  );
}

function getRole(
  guild,
  name
) {

  return guild.roles.cache.find(
    role =>
      role.name === name
  );
}

function getChannel(
  guild,
  id
) {

  return guild.channels.cache.get(
    id
  );
}

function estJuge(member) {

  return member.roles.cache.some(
    role =>
      role.name === ROLE_JUGE
  );
}

function estAvocat(member) {

  return member.roles.cache.some(
    role =>
      role.name === ROLE_AVOCAT
  );
}

function estRepresentant(member) {

  return member.roles.cache.some(
    role =>
      role.name ===
      ROLE_REPRESENTANT
  );
}

function estQOD(member) {

  return member.roles.cache.some(
    role =>
      role.name === ROLE_QOD
  );
}

// ======================================================
// DONNÉES DES RÔLES
// ======================================================

function getRoleData(userId) {

  if (!rolesData[userId]) {

    rolesData[userId] = {

      achetes: [],

      roleEquipe: null,

      dernierEquipement: 0

    };

    saveJSON(
      ROLES_FILE,
      rolesData
    );
  }

  if (
    !Array.isArray(
      rolesData[userId].achetes
    )
  ) {
    rolesData[userId].achetes = [];
  }

  if (
    typeof rolesData[userId]
      .dernierEquipement !==
    "number"
  ) {
    rolesData[userId]
      .dernierEquipement = 0;
  }

  if (
    !("roleEquipe" in rolesData[userId])
  ) {
    rolesData[userId]
      .roleEquipe = null;
  }

  return rolesData[userId];
}

function getUserOwnedRoles(
  userId
) {

  return getRoleData(
    userId
  ).achetes;
}

function hasPurchasedRole(
  userId,
  roleName
) {

  return getUserOwnedRoles(
    userId
  ).includes(
    roleName
  );
}

function addPurchasedRole(
  userId,
  roleName
) {

  const data =
    getRoleData(
      userId
    );

  if (
    !data.achetes.includes(
      roleName
    )
  ) {

    data.achetes.push(
      roleName
    );

    saveJSON(
      ROLES_FILE,
      rolesData
    );
  }
}

function peutEquiper(
  userId
) {

  const data =
    getRoleData(
      userId
    );

  const maintenant =
    Date.now();

  const vingtQuatreHeures =
    24 * 60 * 60 * 1000;

  return (
    maintenant -
    data.dernierEquipement >=
    vingtQuatreHeures
  );
}

function tempsRestantEquipement(
  userId
) {

  const data =
    getRoleData(
      userId
    );

  const vingtQuatreHeures =
    24 * 60 * 60 * 1000;

  return Math.max(
    0,
    vingtQuatreHeures -
      (
        Date.now() -
        data.dernierEquipement
      )
  );
      }
// ======================================================
// UNBELIEVABOAT
// ======================================================

async function modifierArgent(
  userId,
  montant,
  raison
) {

  try {

    const response =
      await fetch(
        `https://unbelievaboat.com/api/v1/guilds/${GUILD_ID}/users/${userId}`,
        {
          method: "PATCH",

          headers: {
            "Authorization":
              UNBELIEVABOAT_TOKEN,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            cash: montant,
            reason: raison
          })
        }
      );

    if (!response.ok) {

      const texte =
        await response.text();

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

async function getCash(
  userId
) {

  try {

    const response =
      await fetch(
        `https://unbelievaboat.com/api/v1/guilds/${GUILD_ID}/users/${userId}`,
        {
          headers: {
            "Authorization":
              UNBELIEVABOAT_TOKEN
          }
        }
      );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    return Number(
      data.cash || 0
    );

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

async function donnerRecompenses(
  plainte,
  condamne
) {

  if (
    plainte.recompenses_distribuees
  ) {

    return [];
  }

  const guild =
    client.guilds.cache.get(
      GUILD_ID
    );

  if (!guild) {
    return [];
  }

  const recompenses = [];

  const plaignant =
    await guild.members
      .fetch(
        plainte.plaignant
      )
      .catch(() => null);

  const accuse =
    await guild.members
      .fetch(
        plainte.accuse
      )
      .catch(() => null);

  const avocat =
    plainte.avocat
      ? await guild.members
          .fetch(
            plainte.avocat
          )
          .catch(() => null)
      : null;

  const representant =
    plainte.representant
      ? await guild.members
          .fetch(
            plainte.representant
          )
          .catch(() => null)
      : null;

  // ====================================================
  // CONDAMNATION
  // ====================================================

  if (condamne) {

    if (plaignant) {

      if (
        estQOD(plaignant)
      ) {

        const ok =
          await modifierArgent(
            plainte.plaignant,
            QOD_GAIN,
            `Affaire #${plainte.id} - Quitte ou double gagné`
          );

        if (ok) {

          recompenses.push(
            `🎲 <@${plainte.plaignant}> — **+20 000** (Quitte ou double)`
          );
        }

      } else {

        const ok =
          await modifierArgent(
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

    if (representant) {

      const ok =
        await modifierArgent(
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

    if (
      accuse &&
      estQOD(accuse)
    ) {

      const ok =
        await modifierArgent(
          plainte.accuse,
          QOD_PERTE,
          `Affaire #${plainte.id} - Quitte ou double perdu`
        );

      if (ok) {

        recompenses.push(
          `🎲 <@${plainte.accuse}> — **-10 000** (Quitte ou double)`
        );
      }
    }

  } else {

    // ==================================================
    // ACQUITTEMENT
    // ==================================================

    if (accuse) {

      if (
        estQOD(accuse)
      ) {

        const ok =
          await modifierArgent(
            plainte.accuse,
            QOD_GAIN,
            `Affaire #${plainte.id} - Quitte ou double gagné`
          );

        if (ok) {

          recompenses.push(
            `🎲 <@${plainte.accuse}> — **+20 000** (Quitte ou double)`
          );
        }

      } else {

        const ok =
          await modifierArgent(
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

    if (avocat) {

      const ok =
        await modifierArgent(
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

    if (
      plaignant &&
      estQOD(plaignant)
    ) {

      const ok =
        await modifierArgent(
          plainte.plaignant,
          QOD_PERTE,
          `Affaire #${plainte.id} - Quitte ou double perdu`
        );

      if (ok) {

        recompenses.push(
          `🎲 <@${plainte.plaignant}> — **-10 000** (Quitte ou double)`
        );
      }
    }
  }

  plainte.recompenses_distribuees =
    true;

  saveJSON(
    DATA_FILE,
    plaintes
  );

  return recompenses;
}

// ======================================================
// CHOIX AUTOMATIQUE APRÈS 2 MINUTES
// ======================================================

async function choisirAutomatiquement(
  guild,
  plainte
) {

  if (
    plainte.statut ===
    "Fermée"
  ) {
    return;
  }

  // ==================================================
  // AVOCAT
  // ==================================================

  if (!plainte.avocat) {

    const role =
      getRole(
        guild,
        ROLE_AVOCAT
      );

    if (role) {

      const candidats =
        role.members.filter(
          member =>
            member.id !==
              plainte.accuse &&
            member.id !==
              plainte.plaignant
        );

      if (
        candidats.size > 0
      ) {

        const tableau =
          [...candidats.values()];

        const choisi =
          tableau[
            Math.floor(
              Math.random() *
              tableau.length
            )
          ];

        plainte.avocat =
          choisi.id;

        saveJSON(
          DATA_FILE,
          plaintes
        );

        const channel =
          getChannel(
            guild,
            plainte.channel_id
          );

        if (channel) {

          await channel.permissionOverwrites
            .edit(
              choisi.id,
              {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              }
            );

          await channel.send(
            `🧑‍💼 **AVOCAT CHOISI AUTOMATIQUEMENT**\n\n` +
            `L'accusé n'ayant pas choisi d'avocat dans les **2 minutes**, ` +
            `${choisi} a été désigné aléatoirement.`
          );
        }
      }
    }
  }

  // ==================================================
  // REPRÉSENTANT
  // ==================================================

  if (!plainte.representant) {

    const role =
      getRole(
        guild,
        ROLE_REPRESENTANT
      );

    if (role) {

      const candidats =
        role.members.filter(
          member =>
            member.id !==
              plainte.accuse &&
            member.id !==
              plainte.plaignant
        );

      if (
        candidats.size > 0
      ) {

        const tableau =
          [...candidats.values()];

        const choisi =
          tableau[
            Math.floor(
              Math.random() *
              tableau.length
            )
          ];

        plainte.representant =
          choisi.id;

        saveJSON(
          DATA_FILE,
          plaintes
        );

        const channel =
          getChannel(
            guild,
            plainte.channel_id
          );

        if (channel) {

          await channel.permissionOverwrites
            .edit(
              choisi.id,
              {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              }
            );

          await channel.send(
            `🛡️ **REPRÉSENTANT CHOISI AUTOMATIQUEMENT**\n\n` +
            `Le plaignant n'ayant pas choisi de représentant dans les **2 minutes**, ` +
            `${choisi} a été désigné aléatoirement.`
          );
        }
      }
    }
  }

  saveJSON(
    DATA_FILE,
    plaintes
  );
}

// ======================================================
// CRÉATION DU DOSSIER
// ======================================================

async function creerDossier(
  guild,
  plainte
) {

  const categorie =
    guild.channels.cache.find(
      channel =>
        channel.type ===
          ChannelType.GuildCategory &&
        (
          channel.name ===
            "⚖️ TRIBUNAL" ||
          channel.name ===
            "📂 AFFAIRES"
        )
    );

  const jugeRole =
    getRole(
      guild,
      ROLE_JUGE
    );

  const courRole =
    getRole(
      guild,
      ROLE_COUR
    );

  const avocatRole =
    getRole(
      guild,
      ROLE_AVOCAT
    );

  const representantRole =
    getRole(
      guild,
      ROLE_REPRESENTANT
    );

  const permissions = [

    {
      id:
        guild.roles.everyone.id,

      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id:
        plainte.plaignant,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    },

    {
      id:
        plainte.accuse,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }

  ];

  if (jugeRole) {

    permissions.push({

      id:
        jugeRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]

    });
  }

  if (courRole) {

    permissions.push({

      id:
        courRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]

    });
  }

  if (avocatRole) {

    permissions.push({

      id:
        avocatRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]

    });
  }

  if (representantRole) {

    permissions.push({

      id:
        representantRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]

    });
  }

  const channel =
    await guild.channels.create({

      name:
        `📁・affaire-${plainte.id}`,

      type:
        ChannelType.GuildText,

      parent:
        categorie
          ? categorie.id
          : null,

      permissionOverwrites:
        permissions

    });

  plainte.channel_id =
    channel.id;

  saveJSON(
    DATA_FILE,
    plaintes
  );

  await channel.send(

    `⚖️ **DOSSIER JUDICIAIRE #${plainte.id}**\n\n` +

    `👤 **Plaignant :** <@${plainte.plaignant}>\n` +

    `⚠️ **Accusé :** <@${plainte.accuse}>\n` +

    `📌 **Motif :** ${plainte.motif}\n` +

    `📄 **Description :** ${plainte.description}\n\n` +

    `⏳ **Statut :** ${plainte.statut}\n\n` +

    `🧑‍💼 **Avocat :** Aucun\n` +

    `🛡️ **Représentant de la défense :** Aucun\n\n` +

    `⚠️ L'accusé choisit son avocat avec :\n` +

    `\`/avocat id:${plainte.id} avocat:@Nom\`\n\n` +

    `⚠️ Le plaignant choisit son représentant avec :\n` +

    `\`/representant id:${plainte.id} representant:@Nom\`\n\n` +

    `⏱️ Après **2 minutes**, le bot tentera de choisir automatiquement.`
  );

  setTimeout(
    async () => {

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

    },
    2 * 60 * 1000
  );

  return channel;
    }
// ======================================================
// COMMANDES SLASH
// ======================================================

const commands = [

  new SlashCommandBuilder()
    .setName("plainte")
    .setDescription(
      "Déposer une plainte"
    )
    .addUserOption(
      option =>
        option
          .setName("accuse")
          .setDescription(
            "Personne accusée"
          )
          .setRequired(true)
    )
    .addStringOption(
      option =>
        option
          .setName("motif")
          .setDescription(
            "Motif de la plainte"
          )
          .setRequired(true)
    )
    .addStringOption(
      option =>
        option
          .setName("description")
          .setDescription(
            "Description des faits"
          )
          .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("plaintes")
    .setDescription(
      "Voir les affaires ouvertes"
    ),

  new SlashCommandBuilder()
    .setName("audience")
    .setDescription(
      "Lancer l'audience d'une affaire"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("condamner")
    .setDescription(
      "Condamner un accusé"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("acquitter")
    .setDescription(
      "Acquitter un accusé"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("verdict")
    .setDescription(
      "Voir le verdict d'une affaire"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("fermer")
    .setDescription(
      "Fermer une affaire"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("avocat")
    .setDescription(
      "Choisir son avocat"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    )
    .addUserOption(
      option =>
        option
          .setName("avocat")
          .setDescription(
            "Avocat choisi"
          )
          .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("representant")
    .setDescription(
      "Choisir son représentant"
    )
    .addIntegerOption(
      option =>
        option
          .setName("id")
          .setDescription(
            "Numéro de l'affaire"
          )
          .setRequired(true)
    )
    .addUserOption(
      option =>
        option
          .setName("representant")
          .setDescription(
            "Représentant choisi"
          )
          .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("acheter-role")
    .setDescription(
      "Acheter définitivement un rôle"
    )
    .addStringOption(
      option =>
        option
          .setName("role")
          .setDescription(
            "Rôle à acheter"
          )
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
    .setDescription(
      "Équiper définitivement un rôle acheté"
    )
    .addStringOption(
      option =>
        option
          .setName("role")
          .setDescription(
            "Rôle à équiper"
          )
          .setRequired(true)
          .addChoices(
            {
              name: "Avocat",
              value: ROLE_AVOCAT
            },
            {
              name: "Représentant de la défense",
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
    .setName("mes-roles")
    .setDescription(
      "Voir les rôles que tu possèdes"
    )

].map(
  command =>
    command.toJSON()
);

// ======================================================
// ENREGISTREMENT DES COMMANDES
// ======================================================

async function enregistrerCommandes() {

  try {

    const rest =
      new REST({
        version: "10"
      }).setToken(
        TOKEN
      );

    await rest.put(
      Routes.applicationGuildCommands(
        client.user.id,
        GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(
      "✅ Commandes slash enregistrées."
    );

  } catch (error) {

    console.error(
      "❌ Erreur enregistrement commandes :",
      error
    );
  }
}

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  Events.InteractionCreate,
  async interaction => {

    try {

      // ==================================================
      // BOUTONS
      // ==================================================

      if (
        interaction.isButton()
      ) {

        const parts =
          interaction.customId.split(
            "_"
          );

        const action =
          parts[0];

        const id =
          Number(parts[1]);

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (
          action ===
            "condamner" ||
          action ===
            "acquitter" ||
          action ===
            "fermer"
        ) {

          if (
            !estJuge(
              interaction.member
            )
          ) {

            return interaction.reply({
              content:
                "❌ Seul le rôle **Juge** peut utiliser ce bouton.",
              ephemeral: true
            });
          }
        }

        if (
          action ===
          "condamner"
        ) {

          if (
            plainte.statut !==
            "En attente"
          ) {

            return interaction.reply({
              content:
                "❌ Un verdict a déjà été rendu.",
              ephemeral: true
            });
          }

          plainte.statut =
            "Condamné";

          plainte.verdict_par =
            interaction.user.id;

          plainte.date_verdict =
            Date.now();

          saveJSON(
            DATA_FILE,
            plaintes
          );

          const recompenses =
            await donnerRecompenses(
              plainte,
              true
            );

          const channel =
            getChannel(
              interaction.guild,
              plainte.channel_id
            );

          if (channel) {

            await channel.send(
              `⚖️ **VERDICT — AFFAIRE #${id}**\n\n` +
              `🔴 <@${plainte.accuse}> est **CONDAMNÉ**.\n\n` +
              `💰 **Récompenses :**\n` +
              (
                recompenses.length
                  ? recompenses.join("\n")
                  : "Aucune."
              )
            );
          }

          return interaction.reply({
            content:
              `🔴 Affaire **#${id}** condamnée.`,
            ephemeral: true
          });
        }

        if (
          action ===
          "acquitter"
        ) {

          if (
            plainte.statut !==
            "En attente"
          ) {

            return interaction.reply({
              content:
                "❌ Un verdict a déjà été rendu.",
              ephemeral: true
            });
          }

          plainte.statut =
            "Acquitté";

          plainte.verdict_par =
            interaction.user.id;

          plainte.date_verdict =
            Date.now();

          saveJSON(
            DATA_FILE,
            plaintes
          );

          const recompenses =
            await donnerRecompenses(
              plainte,
              false
            );

          const channel =
            getChannel(
              interaction.guild,
              plainte.channel_id
            );

          if (channel) {

            await channel.send(
              `⚖️ **VERDICT — AFFAIRE #${id}**\n\n` +
              `🟢 <@${plainte.accuse}> est **ACQUITTÉ**.\n\n` +
              `💰 **Récompenses :**\n` +
              (
                recompenses.length
                  ? recompenses.join("\n")
                  : "Aucune."
              )
            );
          }

          return interaction.reply({
            content:
              `🟢 Affaire **#${id}** acquittée.`,
            ephemeral: true
          });
        }

        if (
          action ===
          "fermer"
        ) {

          plainte.statut =
            "Fermée";

          saveJSON(
            DATA_FILE,
            plaintes
          );

          const channel =
            getChannel(
              interaction.guild,
              plainte.channel_id
            );

          await interaction.reply({
            content:
              `🔒 Affaire **#${id}** fermée.`,
            ephemeral: true
          });

          if (channel) {

            setTimeout(
              async () => {

                try {
                  await channel.delete();
                } catch (error) {
                  console.error(
                    "❌ Erreur suppression salon :",
                    error
                  );
                }

              },
              5000
            );
          }

          return;
        }

        return;
    }
            // ==================================================
      // COMMANDES SLASH
      // ==================================================

      if (
        !interaction.isChatInputCommand()
      ) {
        return;
      }

      // ==================================================
      // /PLAINTE
      // ==================================================

      if (
        interaction.commandName ===
        "plainte"
      ) {

        if (
          estJuge(
            interaction.member
          )
        ) {

          return interaction.reply({
            content:
              "❌ Un juge ne peut pas porter plainte.",
            ephemeral: true
          });
        }

        const accuse =
          interaction.options.getUser(
            "accuse"
          );

        const motif =
          interaction.options.getString(
            "motif"
          );

        const description =
          interaction.options.getString(
            "description"
          );

        if (
          accuse.id ===
          interaction.user.id
        ) {

          return interaction.reply({
            content:
              "❌ Tu ne peux pas porter plainte contre toi-même.",
            ephemeral: true
          });
        }

        const membreAccuse =
          await interaction.guild.members
            .fetch(
              accuse.id
            )
            .catch(
              () => null
            );

        if (!membreAccuse) {

          return interaction.reply({
            content:
              "❌ L'accusé doit être présent sur le serveur.",
            ephemeral: true
          });
        }

        const id =
          nextId();

        const plainte = {

          id,

          plaignant:
            interaction.user.id,

          accuse:
            accuse.id,

          motif,

          description,

          avocat:
            null,

          representant:
            null,

          channel_id:
            null,

          statut:
            "En attente",

          recompenses_distribuees:
            false,

          date_creation:
            Date.now(),

          verdict_par:
            null,

          date_verdict:
            null

        };

        plaintes.push(
          plainte
        );

        saveJSON(
          DATA_FILE,
          plaintes
        );

        await interaction.reply({
          content:
            `⚖️ **Plainte #${id} créée !**`,
          ephemeral: true
        });

        try {

          await creerDossier(
            interaction.guild,
            plainte
          );

        } catch (error) {

          console.error(
            "❌ Erreur création dossier :",
            error
          );

          plainte.statut =
            "Erreur";

          saveJSON(
            DATA_FILE,
            plaintes
          );

          await interaction.followUp({
            content:
              "❌ Impossible de créer le dossier. Vérifie les permissions du bot.",
            ephemeral: true
          });
        }

        return;
      }

      // ==================================================
      // /AVOCAT
      // ==================================================

      if (
        interaction.commandName ===
        "avocat"
      ) {

        const id =
          interaction.options.getInteger(
            "id"
          );

        const avocat =
          interaction.options.getUser(
            "avocat"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (
          plainte.statut !==
          "En attente"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire n'est plus en attente.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !==
          plainte.accuse
        ) {

          return interaction.reply({
            content:
              "❌ Seul l'accusé peut choisir son avocat.",
            ephemeral: true
          });
        }

        const membre =
          await interaction.guild.members
            .fetch(
              avocat.id
            )
            .catch(
              () => null
            );

        if (!membre) {

          return interaction.reply({
            content:
              "❌ Cet utilisateur n'est pas sur le serveur.",
            ephemeral: true
          });
        }

        if (
          !estAvocat(membre)
        ) {

          return interaction.reply({
            content:
              "❌ Cette personne n'a pas le rôle **Avocat**.",
            ephemeral: true
          });
        }

        if (
          avocat.id ===
            plainte.accuse ||
          avocat.id ===
            plainte.plaignant
        ) {

          return interaction.reply({
            content:
              "❌ Tu ne peux pas choisir cette personne.",
            ephemeral: true
          });
        }

        plainte.avocat =
          avocat.id;

        saveJSON(
          DATA_FILE,
          plaintes
        );

        const channel =
          getChannel(
            interaction.guild,
            plainte.channel_id
          );

        if (channel) {

          await channel.permissionOverwrites
            .edit(
              avocat.id,
              {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              }
            );

          await channel.send(
            `🧑‍💼 **AVOCAT DÉSIGNÉ**\n\n` +
            `<@${avocat.id}> représente désormais l'accusé.`
          );
        }

        return interaction.reply({
          content:
            `✅ <@${avocat.id}> a été choisi comme avocat.`,
          ephemeral: true
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
          interaction.options.getInteger(
            "id"
          );

        const representant =
          interaction.options.getUser(
            "representant"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (
          plainte.statut !==
          "En attente"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire n'est plus en attente.",
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

        const membre =
          await interaction.guild.members
            .fetch(
              representant.id
            )
            .catch(
              () => null
            );

        if (!membre) {

          return interaction.reply({
            content:
              "❌ Cet utilisateur n'est pas sur le serveur.",
            ephemeral: true
          });
        }

        if (
          !estRepresentant(membre)
        ) {

          return interaction.reply({
            content:
              "❌ Cette personne n'a pas le rôle **Représentant de la défense**.",
            ephemeral: true
          });
        }

        if (
          representant.id ===
            plainte.plaignant ||
          representant.id ===
            plainte.accuse
        ) {

          return interaction.reply({
            content:
              "❌ Tu ne peux pas choisir cette personne.",
            ephemeral: true
          });
        }

        plainte.representant =
          representant.id;

        saveJSON(
          DATA_FILE,
          plaintes
        );

        const channel =
          getChannel(
            interaction.guild,
            plainte.channel_id
          );

        if (channel) {

          await channel.permissionOverwrites
            .edit(
              representant.id,
              {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              }
            );

          await channel.send(
            `🛡️ **REPRÉSENTANT DÉSIGNÉ**\n\n` +
            `<@${representant.id}> représente désormais la défense.`
          );
        }

        return interaction.reply({
          content:
            `✅ <@${representant.id}> a été choisi comme représentant.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /AUDIENCE
      // ==================================================

      if (
        interaction.commandName ===
        "audience"
      ) {

        if (
          !estJuge(
            interaction.member
          )
        ) {

          return interaction.reply({
            content:
              "❌ Seul un **Juge** peut lancer une audience.",
            ephemeral: true
          });
        }

        const id =
          interaction.options.getInteger(
            "id"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        if (
          plainte.statut !==
          "En attente"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire a déjà été jugée.",
            ephemeral: true
          });
        }

        const channel =
          getChannel(
            interaction.guild,
            plainte.channel_id
          );

        if (!channel) {

          return interaction.reply({
            content:
              "❌ Salon de l'affaire introuvable.",
            ephemeral: true
          });
        }

        const row =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  `condamner_${id}`
                )
                .setLabel(
                  "Condamner"
                )
                .setEmoji("⚠️")
                .setStyle(
                  ButtonStyle.Danger
                ),

              new ButtonBuilder()
                .setCustomId(
                  `acquitter_${id}`
                )
                .setLabel(
                  "Acquitter"
                )
                .setEmoji("✅")
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `fermer_${id}`
                )
                .setLabel(
                  "Fermer"
                )
                .setEmoji("🔒")
                .setStyle(
                  ButtonStyle.Secondary
                )

            );

        await channel.send({

          content:
            `⚖️ **AUDIENCE — AFFAIRE #${id}**\n\n` +
            `Le juge peut maintenant rendre son verdict.`,

          components: [
            row
          ]

        });

        return interaction.reply({
          content:
            `⚖️ Audience de l'affaire **#${id}** lancée.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /PLaintes
      // ==================================================

      if (
        interaction.commandName ===
        "plaintes"
      ) {

        if (
          !estJuge(
            interaction.member
          )
        ) {

          return interaction.reply({
            content:
              "❌ Seul un **Juge** peut voir les plaintes.",
            ephemeral: true
          });
        }

        const ouvertes =
          plaintes.filter(
            plainte =>
              plainte.statut !==
              "Fermée"
          );

        if (
          ouvertes.length === 0
        ) {

          return interaction.reply({
            content:
              "📂 Aucune affaire ouverte.",
            ephemeral: true
          });
        }

        const texte =
          ouvertes
            .map(
              plainte =>
                `⚖️ **#${plainte.id}** — ${plainte.statut}\n` +
                `👤 Plaignant : <@${plainte.plaignant}>\n` +
                `⚠️ Accusé : <@${plainte.accuse}>`
            )
            .join(
              "\n\n"
            );

        return interaction.reply({
          content:
            `📂 **AFFAIRES OUVERTES**\n\n${texte}`,
          ephemeral: true
        });
      }

      // ==================================================
      // /VERDICT
      // ==================================================

      if (
        interaction.commandName ===
        "verdict"
      ) {

        const id =
          interaction.options.getInteger(
            "id"
          );

        const plainte =
          getPlainte(id);

        if (!plainte) {

          return interaction.reply({
            content:
              "❌ Affaire introuvable.",
            ephemeral: true
          });
        }

        let texte =
          `⚖️ **VERDICT — AFFAIRE #${id}**\n\n`;

        texte +=
          `👤 Plaignant : <@${plainte.plaignant}>\n`;

        texte +=
          `⚠️ Accusé : <@${plainte.accuse}>\n`;

        texte +=
          `📌 Motif : ${plainte.motif}\n`;

        texte +=
          `📊 Statut : **${plainte.statut}**\n`;

        if (plainte.avocat) {

          texte +=
            `🧑‍💼 Avocat : <@${plainte.avocat}>\n`;
        }

        if (
          plainte.representant
        ) {

          texte +=
            `🛡️ Représentant : <@${plainte.representant}>\n`;
        }

        if (
          plainte.verdict_par
        ) {

          texte +=
            `⚖️ Juge : <@${plainte.verdict_par}>`;
        }

        return interaction.reply({
          content: texte,
          ephemeral: true
        });
            }
            // ==================================================
      // /ACHETER-ROLE
      // ==================================================

      if (
        interaction.commandName ===
        "acheter-role"
      ) {

        const roleName =
          interaction.options.getString(
            "role"
          );

        const prix =
          PRIX_ROLES[roleName];

        if (!prix) {

          return interaction.reply({
            content:
              "❌ Rôle invalide.",
            ephemeral: true
          });
        }

        // Le rôle est acheté une seule fois
        // et reste définitivement possédé.
        if (
          hasPurchasedRole(
            interaction.user.id,
            roleName
          )
        ) {

          return interaction.reply({
            content:
              `❌ Tu possèdes déjà le rôle **${roleName}**. Utilise \`/equiper\` pour l'équiper.`,
            ephemeral: true
          });
        }

        const argent =
          await getCash(
            interaction.user.id
          );

        if (
          argent === null
        ) {

          return interaction.reply({
            content:
              "❌ Impossible de récupérer ton argent auprès d'UnbelievaBoat.",
            ephemeral: true
          });
        }

        if (
          argent < prix
        ) {

          return interaction.reply({
            content:
              `❌ Tu n'as pas assez d'argent.\n` +
              `💰 Solde : **${argent.toLocaleString("fr-FR")}**\n` +
              `💵 Prix : **${prix.toLocaleString("fr-FR")}**`,
            ephemeral: true
          });
        }

        const role =
          getRole(
            interaction.guild,
            roleName
          );

        if (!role) {

          return interaction.reply({
            content:
              `❌ Le rôle **${roleName}** n'existe pas sur le serveur.`,
            ephemeral: true
          });
        }

        const paiement =
          await modifierArgent(
            interaction.user.id,
            -prix,
            `Achat définitif du rôle ${roleName}`
          );

        if (!paiement) {

          return interaction.reply({
            content:
              "❌ Le paiement a échoué.",
            ephemeral: true
          });
        }

        // Le rôle est enregistré définitivement
        addPurchasedRole(
          interaction.user.id,
          roleName
        );

        return interaction.reply({
          content:
            `🎉 **Rôle acheté définitivement !**\n\n` +
            `🎭 Rôle : **${roleName}**\n` +
            `💰 Prix : **${prix.toLocaleString("fr-FR")}**\n\n` +
            `➡️ Tu le possèdes maintenant définitivement.\n` +
            `🎭 Pour l'équiper, utilise \`/equiper role:${roleName}\`.\n` +
            `⏱️ L'équipement/changement est disponible toutes les **24 heures**.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /EQUIPER
      // ==================================================

      if (
        interaction.commandName ===
        "equiper"
      ) {

        const roleName =
          interaction.options.getString(
            "role"
          );

        const data =
          getRoleData(
            interaction.user.id
          );

        // Vérifier possession
        if (
          !data.achetes.includes(
            roleName
          )
        ) {

          return interaction.reply({
            content:
              `❌ Tu ne possèdes pas le rôle **${roleName}**.`,
            ephemeral: true
          });
        }

        // Si c'est déjà le rôle équipé
        if (
          data.roleEquipe ===
          roleName
        ) {

          return interaction.reply({
            content:
              `🎭 Le rôle **${roleName}** est déjà équipé.`,
            ephemeral: true
          });
        }

        // Vérification des 24 heures
        if (
          !peutEquiper(
            interaction.user.id
          )
        ) {

          const restant =
            tempsRestantEquipement(
              interaction.user.id
            );

          const heures =
            Math.floor(
              restant /
              (60 * 60 * 1000)
            );

          const minutes =
            Math.floor(
              (
                restant %
                (60 * 60 * 1000)
              ) /
              (60 * 1000)
            );

          return interaction.reply({
            content:
              `⏱️ Tu dois encore attendre **${heures}h ${minutes}min** avant de pouvoir changer de rôle équipé.`,
            ephemeral: true
          });
        }

        const role =
          getRole(
            interaction.guild,
            roleName
          );

        if (!role) {

          return interaction.reply({
            content:
              `❌ Le rôle **${roleName}** n'existe plus sur le serveur.`,
            ephemeral: true
          });
        }

        // Vérification hiérarchie
        if (
          role.position >=
          interaction.guild.members.me.roles.highest.position
        ) {

          return interaction.reply({
            content:
              `❌ Je ne peux pas équiper **${roleName}** car ce rôle est au-dessus de mon rôle **Tribunal**.\n\n` +
              `➡️ Va dans **Paramètres du serveur → Rôles** et place le rôle **Tribunal au-dessus de ${roleName}**.`,
            ephemeral: true
          });
        }

        // Retirer l'ancien rôle équipé
        if (
          data.roleEquipe
        ) {

          const ancienRole =
            getRole(
              interaction.guild,
              data.roleEquipe
            );

          if (
            ancienRole &&
            interaction.member.roles.cache.has(
              ancienRole.id
            )
          ) {

            try {

              await interaction.member.roles.remove(
                ancienRole
              );

            } catch (error) {

              console.error(
                "❌ Erreur retrait ancien rôle :",
                error
              );
            }
          }
        }

        // Ajouter le nouveau rôle
        try {

          await interaction.member.roles.add(
            role
          );

        } catch (error) {

          console.error(
            "❌ Erreur équipement rôle :",
            error
          );

          return interaction.reply({
            content:
              "❌ Impossible d'équiper ce rôle. Vérifie que le rôle **Tribunal** est au-dessus du rôle à équiper.",
            ephemeral: true
          });
        }

        // Sauvegarder équipement
        data.roleEquipe =
          roleName;

        data.dernierEquipement =
          Date.now();

        saveJSON(
          ROLES_FILE,
          rolesData
        );

        return interaction.reply({
          content:
            `🎭 **Rôle équipé !**\n\n` +
            `Tu as équipé **${roleName}**.\n` +
            `⏱️ Tu pourras changer de rôle dans **24 heures**.`,
          ephemeral: true
        });
      }

      // ==================================================
      // /MES-ROLES
      // ==================================================

      if (
        interaction.commandName ===
        "mes-roles"
      ) {

        const data =
          getRoleData(
            interaction.user.id
          );

        if (
          data.achetes.length ===
          0
        ) {

          return interaction.reply({
            content:
              "🎭 Tu ne possèdes encore aucun rôle acheté.",
            ephemeral: true
          });
        }

        const liste =
          data.achetes
            .map(
              roleName => {

                if (
                  data.roleEquipe ===
                  roleName
                ) {

                  return `• 🎭 **${roleName}** — **ÉQUIPÉ**`;
                }

                return `• ${roleName}`;

              }
            )
            .join("\n");

        return interaction.reply({
          content:
            `🎭 **TES RÔLES POSSÉDÉS**\n\n` +
            liste +
            `\n\n💡 Tu peux équiper un rôle avec \`/equiper\`.`,
          ephemeral: true
        });
      }

    } catch (error) {

      console.error(
        "❌ Erreur InteractionCreate :",
        error
      );

      try {

        if (
          interaction.replied ||
          interaction.deferred
        ) {

          await interaction.followUp({
            content:
              "❌ Une erreur est survenue.",
            ephemeral: true
          });

        } else {

          await interaction.reply({
            content:
              "❌ Une erreur est survenue.",
            ephemeral: true
          });
        }

      } catch {}
    }
  }
);

// ======================================================
// CONNEXION DU BOT
// ======================================================

client.once(
  Events.ClientReady,
  async readyClient => {

    console.log(
      `✅ Tribunal connecté : ${readyClient.user.tag}`
    );

    await enregistrerCommandes();

    console.log(
      "⚖️ Tribunal prêt !"
    );
  }
);

// ======================================================
// LOGIN
// ======================================================

client.login(
  TOKEN
);
