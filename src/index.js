const {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");


// ==========================
// CONFIGURATION
// ==========================

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN est manquant.");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ GUILD_ID est manquant.");
  process.exit(1);
}


// ==========================
// BASE DE DONNÉES
// ==========================

const DATA_DIR = process.env.DATA_DIR || ".";
const DATA_FILE = path.join(
  DATA_DIR,
  "plaintes.json"
);

if (
  !fs.existsSync(DATA_DIR) &&
  DATA_DIR !== "."
) {
  fs.mkdirSync(DATA_DIR, {
    recursive: true
  });
}


function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        "[]",
        "utf8"
      );

      return [];
    }

    const content =
      fs.readFileSync(
        DATA_FILE,
        "utf8"
      );

    if (!content.trim()) {
      return [];
    }

    return JSON.parse(content);

  } catch (error) {

    console.error(
      "❌ Impossible de charger les plaintes :",
      error
    );

    return [];
  }
}


function saveData(data) {
  try {

    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        data,
        null,
        2
      ),
      "utf8"
    );

  } catch (error) {

    console.error(
      "❌ Impossible de sauvegarder les plaintes :",
      error
    );
  }
}


let plaintes = loadData();


function nextId() {

  if (plaintes.length === 0) {
    return 1;
  }

  return (
    Math.max(
      ...plaintes.map(
        plainte => plainte.id
      )
    ) + 1
  );
}


function getPlainte(id) {

  return plaintes.find(
    plainte => plainte.id === id
  );
}


// ==========================
// CLIENT DISCORD
// ==========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});


// ==========================
// OUTILS
// ==========================

function getRole(guild, roleName) {

  return guild.roles.cache.find(
    role => role.name === roleName
  );
}


function estJuge(member) {

  return member.roles.cache.some(
    role => role.name === "Juge"
  );
}


function estAvocat(member) {

  return member.roles.cache.some(
    role => role.name === "Avocat"
  );
}


// ==========================
// CRÉER LE SALON D'UNE AFFAIRE
// ==========================

async function creerDossierAffaire(
  guild,
  plainte
) {

  const categorie =
    guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildCategory &&
        (
          channel.name === "⚖️ TRIBUNAL" ||
          channel.name === "📂 AFFAIRES"
        )
    );

  const jugeRole =
    getRole(guild, "Juge");

  const courRole =
    getRole(guild, "Cour");

  const plaignant =
    await guild.members.fetch(
      plainte.plaignant
    ).catch(() => null);

  const accuse =
    await guild.members.fetch(
      plainte.accuse
    ).catch(() => null);


  const permissions = [

    // ==========================
    // PERSONNES
    // ==========================

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


  // ==========================
  // JUGE
  // ==========================

  if (jugeRole) {

    permissions.push({
      id: jugeRole.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }


  // ==========================
  // COUR
  // ==========================

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


  // ==========================
  // CRÉATION DU SALON
  // ==========================

  const channel =
    await guild.channels.create({

      name:
        `📁・affaire-${plainte.id}`,

      type:
        ChannelType.GuildText,

      parent:
        categorie ? categorie.id : null,

      permissionOverwrites:
        permissions
    });


  plainte.channel_id =
    channel.id;


  // ==========================
  // MESSAGE DU DOSSIER
  // ==========================

  await channel.send({

    content:
      `⚖️ **DOSSIER JUDICIAIRE #${plainte.id}**\n\n` +

      `👤 **Plaignant :** <@${plainte.plaignant}>\n` +
      `⚠️ **Accusé :** <@${plainte.accuse}>\n` +
      `📌 **Motif :** ${plainte.motif}\n\n` +

      `📄 **Description :**\n` +
      `${plainte.description}\n\n` +

      `━━━━━━━━━━━━━━━━━━━━\n\n` +

      `⏳ **Statut :** ${plainte.statut}\n\n` +

      `🧑‍💼 **Avocat :** Aucun avocat choisi pour le moment.\n\n` +

      `⚖️ L'accusé peut choisir son avocat avec :\n` +
      `\`/avocat id:${plainte.id} avocat:@Nom\``
  });


  return channel;
}


// ==========================
// BOT PRÊT
// ==========================

client.once(
  Events.ClientReady,
  async bot => {

    console.log(
      `⚖️ Tribunal en ligne : ${bot.user.tag}`
    );

    console.log(
      `📁 ${plaintes.length} plainte(s) chargée(s).`
    );


    const guild =
      bot.guilds.cache.get(
        GUILD_ID
      );


    if (!guild) {

      console.error(
        "❌ Serveur introuvable."
      );

      return;
    }


    console.log(
      `🏛️ Serveur trouvé : ${guild.name}`
    );

    console.log("✅ Tribunal prêt.");
  }
);


// ==========================
// INTERACTIONS
// ==========================

client.on(
  Events.InteractionCreate,
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }


    try {

      // ==================================================
      // /PLAINTE
      // ==================================================

      if (
        interaction.commandName === "plainte"
      ) {

        if (
          estJuge(interaction.member)
        ) {

          return interaction.reply({
            content:
              "❌ Un Juge ne peut pas déposer de plainte.",
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
          accuse.id === interaction.user.id
        ) {

          return interaction.reply({
            content:
              "❌ Tu ne peux pas déposer une plainte contre toi-même.",
            ephemeral: true
          });
        }


        const plainte = {

          id: nextId(),

          plaignant:
            interaction.user.id,

          accuse:
            accuse.id,

          motif:
            motif,

          description:
            description,

          statut:
            "En attente",

          juge:
            null,

          avocat:
            null,

          peine:
            null,

          raison:
            null,

          channel_id:
            null,

          created_at:
            new Date().toISOString(),

          verdict_at:
            null
        };


        plaintes.push(
          plainte
        );

        saveData(
          plaintes
        );


        let channel = null;

        try {

          channel =
            await creerDossierAffaire(
              interaction.guild,
              plainte
            );

          saveData(
            plaintes
          );

        } catch (error) {

          console.error(
            "❌ Impossible de créer le dossier :",
            error
          );
        }


        return interaction.reply({

          content:

            `⚖️ **PLAINTE ENREGISTRÉE**\n\n` +

            `📁 Affaire : **#${plainte.id}**\n` +

            `👤 Plaignant : ${interaction.user}\n` +

            `⚠️ Accusé : ${accuse}\n` +

            `📌 Motif : **${motif}**\n` +

            `📄 Description : ${description}\n\n` +

            `⏳ Statut : **En attente**` +

            (
              channel
                ? `\n\n📂 Dossier : ${channel}`
                : `\n\n⚠️ Le dossier n'a pas pu être créé.`
            )
        });
      }


      // ==================================================
      // /PLAINTES
      // ==================================================

      if (
        interaction.commandName === "plaintes"
      ) {

        if (
          !estJuge(interaction.member)
        ) {

          return interaction.reply({
            content:
              "❌ Cette commande est réservée au rôle **Juge**.",
            ephemeral: true
          });
        }


        if (
          plaintes.length === 0
        ) {

          return interaction.reply({
            content:
              "📁 Aucune plainte enregistrée.",
            ephemeral: true
          });
        }


        const liste =
          plaintes
            .slice()
            .reverse()
            .map(
              plainte =>
                `**#${plainte.id}** — ${plainte.statut}\n` +
                `👤 Accusé : <@${plainte.accuse}>\n` +
                `📌 Motif : ${plainte.motif}`
            )
            .join("\n\n");


        return interaction.reply({

          content:
            `⚖️ **PLAINTES DU TRIBUNAL**\n\n${liste}`,

          ephemeral: true
        });
      }


      // ==================================================
      // /AVOCAT
      // ==================================================

      if (
        interaction.commandName === "avocat"
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
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }


        // ==========================
        // SEUL L'ACCUSÉ PEUT CHOISIR
        // ==========================

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


        // ==========================
        // AFFAIRE FERMÉE
        // ==========================

        if (
          plainte.statut === "Fermée"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
            ephemeral: true
          });
        }


        const avocatMember =
          await interaction.guild.members
            .fetch(avocat.id)
            .catch(() => null);


        if (!avocatMember) {

          return interaction.reply({
            content:
              "❌ Cette personne n'est pas sur le serveur.",
            ephemeral: true
          });
        }


        // ==========================
        // VÉRIFICATION DU RÔLE
        // ==========================

        if (
          !estAvocat(avocatMember)
        ) {

          return interaction.reply({
            content:
              "❌ Cette personne n'a pas le rôle **Avocat**.",
            ephemeral: true
          });
        }


        // ==========================
        // AJOUT DE L'AVOCAT
        // ==========================

        plainte.avocat =
          avocat.id;


        saveData(
          plaintes
        );


        // ==========================
        // TROUVER LE DOSSIER
        // ==========================

        let channel = null;


        if (
          plainte.channel_id
        ) {

          channel =
            interaction.guild.channels.cache.get(
              plainte.channel_id
            );
        }


        if (!channel) {

          return interaction.reply({
            content:
              "❌ Le salon du dossier est introuvable.",
            ephemeral: true
          });
        }


        // ==========================
        // DONNER L'ACCÈS
        // ==========================

        await channel.permissionOverwrites.edit(
          avocat.id,
          {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          }
        );


        // ==========================
        // MESSAGE DANS LE DOSSIER
        // ==========================

        await channel.send({

          content:
            `🧑‍💼 **AVOCAT DÉSIGNÉ**\n\n` +

            `L'accusé <@${plainte.accuse}> a choisi ${avocat} comme avocat.\n\n` +

            `🧑‍💼 L'avocat dispose maintenant de l'accès au dossier et peut participer à la discussion.`
        });


        return interaction.reply({

          content:
            `✅ ${avocat} est maintenant ton avocat pour l'affaire **#${id}**.\n\n` +
            `🧑‍💼 Il peut maintenant voir et participer à la discussion du dossier.`,

          ephemeral: true
        });
      }


      // ==================================================
      // /AUDIENCE
      // ==================================================

      if (
        interaction.commandName === "audience"
      ) {

        if (
          !estJuge(interaction.member)
        ) {

          return interaction.reply({
            content:
              "❌ Cette commande est réservée au rôle **Juge**.",
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
              "❌ Cette affaire n'existe pas.",
            ephemeral: true
          });
        }


        if (
          plainte.statut === "Fermée"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
            ephemeral: true
          });
        }


        plainte.statut =
          "Audience ouverte";

        plainte.juge =
          interaction.user.id;


        saveData(
          plaintes
        );


        let channel = null;


        if (
          plainte.channel_id
        ) {

          channel =
            interaction.guild.channels.cache.get(
              plainte.channel_id
            );
        }


        const message =
          `⚖️ **OUVERTURE DE L'AUDIENCE**\n\n` +

          `Le Tribunal est officiellement réuni.\n` +

          `L'accusé est appelé à comparaître.\n\n` +

          `━━━━━━━━━━━━━━━━━━━━\n\n` +

          `📁 **Affaire #${id}**\n` +

          `👤 Accusé : <@${plainte.accuse}>\n` +

          `👤 Plaignant : <@${plainte.plaignant}>\n` +

          `📌 Motif : **${plainte.motif}**\n\n` +

          `⚖️ Juge : ${interaction.user}\n\n` +

          `🔔 **L'audience commence maintenant.**`;


        if (channel) {

          await channel.send({
            content: message
          });
        }


        return interaction.reply({
          content: message
        });
      }


      // ==================================================
      // /CONDAMNER
      // ==================================================

      if (
        interaction.commandName === "condamner"
      ) {

        if (
          !estJuge(interaction.member)
        ) {

          return interaction.reply({
            content:
              "❌ Cette commande est réservée au rôle **Juge**.",
            ephemeral: true
          });
        }


        const id =
          interaction.options.getInteger(
            "id"
          );

        const peine =
          interaction.options.getString(
            "peine"
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


        if (
          plainte.statut === "Fermée"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
            ephemeral: true
          });
        }


        plainte.statut =
          "Coupable / Condamné";

        plainte.juge =
          interaction.user.id;

        plainte.peine =
          peine;

        plainte.verdict_at =
          new Date().toISOString();


        saveData(
          plaintes
        );


        const message =
          `⚖️ **VERDICT DU TRIBUNAL**\n\n` +

          `📁 Affaire : **#${id}**\n` +

          `👤 Accusé : <@${plainte.accuse}>\n` +

          `👤 Plaignant : <@${plainte.plaignant}>\n\n` +

          `🔨 Verdict : **COUPABLE**\n\n` +

          `📜 Peine : ${peine}\n\n` +

          `⚖️ Jugement rendu par ${interaction.user}`;


        if (
          plainte.channel_id
        ) {

          const channel =
            interaction.guild.channels.cache.get(
              plainte.channel_id
            );

          if (channel) {

            await channel.send({
              content: message
            });
          }
        }


        return interaction.reply({
          content:
            message +
            `\n\n🔔 L'affaire peut maintenant être fermée avec \`/fermer\`.`
        });
      }


      // ==================================================
      // /ACQUITTER
      // ==================================================

      if (
        interaction.commandName === "acquitter"
      ) {

        if (
          !estJuge(interaction.member)
        ) {

          return interaction.reply({
            content:
              "❌ Cette commande est réservée au rôle **Juge**.",
            ephemeral: true
          });
        }


        const id =
          interaction.options.getInteger(
            "id"
          );

        const raison =
          interaction.options.getString(
            "raison"
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


        if (
          plainte.statut === "Fermée"
        ) {

          return interaction.reply({
            content:
              "❌ Cette affaire est déjà fermée.",
            ephemeral: true
          });
        }


        plainte.statut =
          "Acquitté";

        plainte.juge =
          interaction.user.id;

        plainte.raison =
          raison;

        plainte.verdict_at =
          new Date().toISOString();


        saveData(
          plaintes
        );


        const message =
          `⚖️ **VERDICT DU TRIBUNAL**\n\n` +

          `📁 Affaire : **#${id}**\n` +

          `👤 Accusé : <@${plainte.accuse}>\n` +

          `👤 Plaignant : <@${plainte.plaignant}>\n\n` +

          `✅ Verdict : **ACQUITTÉ**\n\n` +

          `📄 Raison : ${raison}\n\n` +

          `⚖️ Jugement rendu par ${interaction.user}`;


        if (
          plainte.channel_id
        ) {

          const channel =
            interaction.guild.channels.cache.get(
                    plainte.channel_id
            );

            if (channel) {

              await channel.send({
                content:
                  `🔒 **AFFAIRE #${id} FERMÉE**\n\n` +
                  `Cette affaire est maintenant officiellement fermée.\n\n` +
                  `⚖️ Fermée par ${interaction.user}`
              });

              await channel.permissionOverwrites.edit(
                interaction.guild.roles.everyone.id,
                {
                  ViewChannel: false
                }
              );

              await channel.permissionOverwrites.edit(
                plainte.accuse,
                {
                  SendMessages: false
                }
              );

              await channel.permissionOverwrites.edit(
                plainte.plaignant,
                {
                  SendMessages: false
                }
              );

              if (plainte.avocat) {

                await channel.permissionOverwrites.edit(
                  plainte.avocat,
                  {
                    SendMessages: false
                  }
                );
              }
            }
          }
        }

        return interaction.reply({
          content:
            `🔒 **AFFAIRE FERMÉE**\n\n` +
            `L'affaire **#${id}** est maintenant officiellement fermée.`
        });
      }


      // ==========================
      // /AIDE
      // ==========================

      if (interaction.commandName === "aide") {

        return interaction.reply({
          content:
            `⚖️ **TRIBUNAL — COMMANDES**\n\n` +
            `📝 \`/plainte\` — Déposer une plainte\n` +
            `📁 \`/plaintes\` — Voir les plaintes (Juge)\n` +
            `⚖️ \`/audience\` — Ouvrir une audience (Juge)\n` +
            `🔨 \`/condamner\` — Condamner (Juge)\n` +
            `✅ \`/acquitter\` — Acquitter (Juge)\n` +
            `📜 \`/verdict\` — Voir un verdict\n` +
            `🔒 \`/fermer\` — Fermer une affaire (Juge)\n` +
            `🧑‍💼 \`/avocat\` — Choisir son avocat\n` +
            `❓ \`/aide\` — Afficher cette aide`,
          ephemeral: true
        });
      }

    } catch (error) {

      console.error(
        "❌ Erreur pendant l'exécution d'une commande :",
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.reply({
          content:
            "❌ Une erreur est survenue pendant l'exécution de la commande.",
          ephemeral: true
        });
      }
    }
  }
);


// ==========================
// ERREURS
// ==========================

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled Rejection :",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ Uncaught Exception :",
      error
    );
  }
);


// ==========================
// CONNEXION
// ==========================

client.login(TOKEN);
