require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChannelType
} = require("discord.js");
const axios = require("axios");
const ping = require("ping");
const whois = require('whois-json');

const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.DirectMessageTyping,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMessageTyping
    ],
    partials: ['CHANNEL', 'MESSAGE'] // This is important for DM functionality
  });
  
// Commands that should work in DMs (registered globally)
const globalCommands = [
  {
    name: "fetch_data",
    description: "Fetches data from an API",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "url",
        description: "The URL to fetch data from",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  {
    name: "ping",
    description: "Pings a remote server.",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "ip",
        description: "The IP Adress to ping.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  {
    name: "server_status",
    description: "Fetches data from an API",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "raw",
        description: "Display raw JSON data",
        type: ApplicationCommandOptionType.Boolean,
        required: false,
      },
    ],
  },
  {
    name: "cody",
    description: "Ask Cody (Sourcegraph AI) a coding question",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "question",
        description: "Your coding question",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  {
    name: "weather",
    description: "Get current weather for a location",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "location",
        description: "City name or postal code",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  {
    name: "mcstatus",
    description: "Check the status of a Minecraft server",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "server",
        description: "Server address (e.g., mc.hypixel.net)",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "bedrock",
        description: "Is this a Bedrock server? (Default: false)",
        type: ApplicationCommandOptionType.Boolean,
        required: false,
      },
    ],
  },
  {
    name: "animal",
    description: "Get a random animal image",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "type",
        description: "Type of animal",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: "Dog", value: "dog" },
          { name: "Cat", value: "cat" },
          { name: "Panda", value: "panda" },
          { name: "Fox", value: "fox" },
          { name: "Bird", value: "bird" },
          { name: "Koala", value: "koala" },
          { name: "Red Panda", value: "red_panda" },
          { name: "Raccoon", value: "raccoon" },
          { name: "Kangaroo", value: "kangaroo" }
        ]
      },
    ],
  },
  {
    name: "anime",
    description: "Get anime-related content",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "type",
        description: "Type of anime content",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: "Wink", value: "wink" },
          { name: "Pat", value: "pat" },
          { name: "Hug", value: "hug" },
          { name: "Face Palm", value: "face-palm" },
          { name: "Quote", value: "quote" }
        ]
      },
    ],
  },
  {
    name: "checkdns",
    description: "Check if a domain is blocked by running it through a DNS server",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "domain",
        description: "Domain name to check (e.g. example.com)",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "provider",
        description: "DNS provider to use",
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: "Cloudflare (1.1.1.1)", value: "1.1.1.1" },
          { name: "Google (8.8.8.8)", value: "8.8.8.8" },
          { name: "OpenDNS", value: "208.67.222.222" },
          { name: "Quad9", value: "9.9.9.9" },
          { name: "AdGuard", value: "94.140.14.14" },
          { name: "Turknet", value: "193.192.98.8" },
          { name: "TTnet", value: "195.175.39.49" },
          { name: "Turkcell", value: "195.175.39.49" },
          { name: "Superonline", value: "195.114.66.100" }
        ]
      }
    ]
  },
  {
    name: "traceroute",
    description: "Show network path to a destination",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "target",
        description: "IP address or domain to trace (might take a long time to complete)",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "hops",
        description: "Maximum number of hops (default: 30)",
        type: ApplicationCommandOptionType.Integer,
        required: false,
        min_value: 1,
        max_value: 32
      }
    ]
  },
  {
    name: "whois",
    description: "Get domain registration information",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "domain",
        description: "Domain to lookup (e.g. example.com)",
        type: ApplicationCommandOptionType.String,
        required: true,
      }
    ]
  },
  {
    name: "stats",
    description: "Show bot and server statistics",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true
  },
  {
    name: "checkport",
    description: "Check if specific ports are open on a domain",
    type: ApplicationCommandType.ChatInput,
    dm_permission: true,
    options: [
      {
        name: "target",
        description: "Domain or IP to scan",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "ports",
        description: "Ports to scan (comma separated, e.g. 80,443,3306)",
        type: ApplicationCommandOptionType.String,
        required: true,
      }
    ]
  }
];

// Commands that only make sense in a guild context
const guildCommands = [
  // Add guild-specific commands here if needed
];

// User context menu commands (should also be registered globally)
const userCommands = [
  {
    name: "User Info",
    type: ApplicationCommandType.User,
  },
];

// Function to get existing commands without deleting them
async function getExistingCommands(rest, route) {
  try {
    return await rest.get(route);
  } catch (error) {
    console.error(`Error fetching commands from ${route}:`, error);
    return [];
  }
}

// New function to safely update commands
async function updateCommandsSafely() {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error("Missing required environment variables: DISCORD_TOKEN or CLIENT_ID");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Starting command registration...");

    // First, get all existing global commands to check for entry point commands
    const existingGlobalCommands = await getExistingCommands(
      rest, 
      Routes.applicationCommands(process.env.CLIENT_ID)
    );
    
    // Find any entry point or special commands we need to preserve
    const entryPointCommands = existingGlobalCommands.filter(
      cmd => cmd.integration_types && cmd.integration_types.includes(1)
    );
    
    // Create a map to track command names we've already added
    const commandNameMap = new Map();
    
    // Create a filtered array of commands without duplicates
    const allGlobalCommands = [];
    
    // First add global commands
    for (const cmd of globalCommands) {
      if (!commandNameMap.has(cmd.name)) {
        commandNameMap.set(cmd.name, true);
        allGlobalCommands.push(cmd);
      } else {
        console.warn(`Skipping duplicate global command: ${cmd.name}`);
      }
    }
    
    // Then add user commands
    for (const cmd of userCommands) {
      if (!commandNameMap.has(cmd.name)) {
        commandNameMap.set(cmd.name, true);
        allGlobalCommands.push(cmd);
      } else {
        console.warn(`Skipping duplicate user command: ${cmd.name}`);
      }
    }
    
    // Finally, add entry point commands that don't duplicate existing names
    for (const cmd of entryPointCommands) {
      if (!commandNameMap.has(cmd.name)) {
        commandNameMap.set(cmd.name, true);
        allGlobalCommands.push(cmd);
      } else {
        console.log(`Entry point command "${cmd.name}" already exists, keeping existing definition`);
      }
    }
    
    console.log(`Registering ${allGlobalCommands.length} unique global commands...`);
    
    // Update global commands (including DM-compatible commands)
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID), 
      { body: allGlobalCommands }
    );
    console.log(`Successfully registered ${allGlobalCommands.length} global commands`);
    
    // If we have guild-specific commands, register them for each guild
    if (guildCommands.length > 0) {
      // Wait for client to be ready to access guilds
      if (!client.isReady()) {
        await new Promise(resolve => {
          client.once('ready', resolve);
        });
      }
      
      // Register guild commands for each guild the bot is in
      for (const guild of client.guilds.cache.values()) {
        console.log(`Registering guild commands for ${guild.name} (${guild.id})...`);
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id),
          { body: guildCommands }
        );
      }
      console.log(`Successfully registered ${guildCommands.length} guild commands per server`);
    }

    console.log("All commands registered successfully!");
  } catch (error) {
    console.error("Error updating commands:", error);
    if (error.code === 50240) {
      console.error("This error suggests you need to include all Entry Point commands in your update.");
      console.error("Try using the updateCommandsSafely function which preserves Entry Point commands.");
    }
  }
}


// Function to ask Cody a question and parse the streaming response
async function askCody(question) {
  // [Function implementation remains the same]
  if (!process.env.SOURCEGRAPH_API_KEY) {
    throw new Error("SOURCEGRAPH_API_KEY is not set in environment variables");
  }

  if (question.length > 1999) {
    throw new Error("Input question is too long - must be 1999 characters or less");
  }

  try {
    const response = await axios({
      method: 'post',
      url: 'https://sourcegraph.com/.api/completions/stream',
      data: {
        messages: [
          {
            speaker: "human",
            text: question
          }
        ],
        temperature: 0.3,
        maxTokensToSample: 2000,
        topK: 50,
        topP: 0.95
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${process.env.SOURCEGRAPH_API_KEY}`
      },
      responseType: 'text'
    });

    const events = response.data.split('\n\n').filter(line => line.trim() !== '');
    
    let fullCompletion = '';
    
    for (const event of events) {
      const lines = event.split('\n');
      const eventType = lines[0].replace('event: ', '');
      
      if (eventType === 'completion') {
        const dataLine = lines[1];
        if (dataLine && dataLine.startsWith('data: ')) {
          try {
            const jsonData = JSON.parse(dataLine.substring(6));
            if (jsonData.completion) {
              fullCompletion = jsonData.completion;
            }
          } catch (e) {
            console.error('Error parsing JSON from Cody response:', e);
          }
        }
      }
    }
    
    return fullCompletion;
  } catch (error) {
    console.error('Error calling Cody API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // Register commands after the bot is ready
  await updateCommandsSafely();

  // Send startup notification
  if (process.env.OWNER_ID) {
    try {
      const ownerId = process.env.OWNER_ID;
      const owner = await client.users.fetch(ownerId);
      const startupEmbed = {
        title: "Bot Status Update",
        description: `Bot started successfully at <t:${Math.floor(Date.now() / 1000)}:F>`,
        color: 0x00ff00,
        fields: [
          {
            name: "Bot Name",
            value: client.user.tag,
            inline: true
          },
          {
            name: "Relative Time",
            value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
            inline: true
          }
        ],
        footer: {
          text: "blahaj.tr"
        }
      };
      
      await owner.send({ embeds: [startupEmbed] });
    } catch (error) {
      console.error("Failed to send startup notification:", error);
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  // Add debug logging to help diagnose DM issues
  console.log(`Received interaction: ${interaction.commandName} | Channel type: ${interaction.channel.type} | DM: ${interaction.channel.type === ChannelType.DM}`);
  
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    try {
      switch (interaction.commandName) {
        case "fetch_data":
          try {
            const url = interaction.options.getString("url");
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
              await interaction.reply({
                content: "Please provide a valid URL starting with http:// or https://",
                ephemeral: true,
              });
              return;
            }
            const response = await axios.get(url);
            await interaction.reply({
              content: `\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``,
            });
          } catch (error) {
            console.error(error);
            await interaction.reply({ content: "Failed to fetch data.", ephemeral: true });
          }
          break;

        case "ping":
          try {
            await interaction.deferReply();
            const ip = interaction.options.getString("ip");
            const pingResult = await ping.promise.probe(ip);
            if (pingResult.time == "unknown") {
              await interaction.editReply({
                content: "Unable to ping the IP address.",
                ephemeral: true,
              });
              return;
            }
            const pingEmbed = {
              title: "Ping Results",
              description: `Results for IP: ${ip}`,
              color: 0x00ff00,
              fields: [
                {
                  name: "Response Time",
                  value: `${pingResult.time}ms`,
                  inline: true
                }
              ],
              timestamp: new Date(),
              footer: {
                text: "Ping Command"
              }
            };
            await interaction.editReply({ embeds: [pingEmbed] });
          } catch (error) {
            console.error(error);
            await interaction.editReply({ content: "Failed to ping.", ephemeral: true });
          }
          break;
          
        case "server_status":
          try {
            const response = await axios.get("https://blahaj.tr:2589/status");
            const isRaw = interaction.options.getBoolean("raw") ?? false;

            if (isRaw) {
              await interaction.reply({
                content: `\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``,
              });
            } else {
              let formattedResponse = "";
              const fields = [];
              for (const [server, data] of Object.entries(response.data)) {
                const status = data.online ? "🟢 Online" : "🔴 Offline";
                const responseTime = data.responseTime.toFixed(2);
                fields.push({
                  name: server,
                  value: `Status: ${status}\nResponse Time: ${responseTime}ms`,
                  inline: true
                });
              }
              
              const statusEmbed = {
                title: "Server Status",
                color: 0x00ff00,
                fields: fields,
                timestamp: new Date(),
                footer: {
                  text: "Server Status Command"
                }
              };
              
              await interaction.reply({ embeds: [statusEmbed] });
            }
          } catch (error) {
            console.error(error);
            await interaction.reply({ content: "Failed to get status.", ephemeral: true });
          }
          break;        
          
        case "cody":
          try {
            await interaction.deferReply();
            const question = interaction.options.getString("question");
            
            if (!process.env.SOURCEGRAPH_API_KEY) {
              await interaction.editReply({ 
                content: "Sourcegraph API key not configured. Please add SOURCEGRAPH_API_KEY to your environment variables.",
                ephemeral: true 
              });
              return;
            }
            
            console.log(`Asking Cody: ${question}`);
            
            // Call Cody API
            const codyResponse = await askCody(question);
            
            console.log(`Cody response received: ${codyResponse ? 'yes' : 'no'}`);
            
            // Format the response
            let formattedResponse = codyResponse || "No response received from Cody.";
            
            // Calculate total length including the question
            const fullResponse = `**Question:** ${question}\n\n**Cody's Answer:**\n${formattedResponse}`;
            
            // If the response is too long for Discord (which has a 2000 character limit)
            if (fullResponse.length > 1900) {
              formattedResponse = formattedResponse.substring(0, 1900 - question.length - 50) + "...\n(Response truncated due to Discord's character limit)";
            }
            
            await interaction.editReply({ 
              content: `**Question:** ${question}\n\n**Cody's Answer:**\n${formattedResponse}`
            });
          } catch (error) {
            console.error("Cody API error:", error);
            await interaction.editReply({ 
              content: "Sorry, I couldn't get an answer from Cody. Please try again later.",
              ephemeral: true 
            });
          }
          break;
          
        case "weather":
          try {
            await interaction.deferReply();
            const location = interaction.options.getString("location");
            
            // Make sure you have WEATHER_API_KEY in your .env file
            if (!process.env.WEATHER_API_KEY) {
              await interaction.editReply({ 
                content: "Weather API key not configured. Please add WEATHER_API_KEY to your environment variables.",
                ephemeral: true 
              });
              return;
            }
            
            const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${encodeURIComponent(location)}&aqi=no`;
            const response = await axios.get(weatherUrl);
            
            const data = response.data;
            const location_name = data.location.name;
            const region = data.location.region;
            const country = data.location.country;
            const temp_c = data.current.temp_c;
            const temp_f = data.current.temp_f;
            const condition = data.current.condition.text;
            const humidity = data.current.humidity;
            const wind_kph = data.current.wind_kph;
            const wind_mph = data.current.wind_mph;
            const feelslike_c = data.current.feelslike_c;
            const feelslike_f = data.current.feelslike_f;
            
            const weatherEmbed = {
              title: `Weather for ${location_name}, ${region}, ${country}`,
              description: `Current condition: ${condition}`,
              fields: [
                { name: 'Temperature', value: `${temp_c}°C / ${temp_f}°F`, inline: true },
                { name: 'Feels Like', value: `${feelslike_c}°C / ${feelslike_f}°F`, inline: true },
                { name: 'Humidity', value: `${humidity}%`, inline: true },
                { name: 'Wind Speed', value: `${wind_kph} km/h / ${wind_mph} mph`, inline: true }
              ],
              thumbnail: { url: `https:${data.current.condition.icon}` },
              timestamp: new Date(),
              footer: { text: 'Powered by WeatherAPI.com' }
            };
            
            await interaction.editReply({ embeds: [weatherEmbed] });
          } catch (error) {
            console.error(error);
            await interaction.editReply({ 
              content: "Failed to fetch weather data. Please check the location name and try again.", 
              ephemeral: true 
            });
          }
          break;
          
        // Handle all the other commands the same way as in the original code
        case "mcstatus":
          try {
            await interaction.deferReply();
            const serverAddress = interaction.options.getString("server");
            const isBedrock = interaction.options.getBoolean("bedrock") ?? false;
            
            const apiUrl = isBedrock 
              ? `https://api.mcsrvstat.us/bedrock/2/${encodeURIComponent(serverAddress)}`
              : `https://api.mcsrvstat.us/2/${encodeURIComponent(serverAddress)}`;
            
            const response = await axios.get(apiUrl);
            const data = response.data;
            
            if (!data.online) {
              await interaction.editReply({
                content: `📡 **${serverAddress}** is currently offline or could not be reached.`
              });
              return;
            }
            
            const serverEmbed = {
              title: `Minecraft Server Status: ${serverAddress}`,
              color: 0x44FF44,
              thumbnail: { 
                url: 'https://www.minecraft.net/content/dam/games/minecraft/key-art/MC_The-Wild-Update_540x300.jpg'
              },
              fields: [
                { name: 'Status', value: data.online ? '✅ Online' : '❌ Offline', inline: true },
                { name: 'Players', value: data.players ? `${data.players.online}/${data.players.max}` : 'Unknown', inline: true },
                { name: 'Version', value: data.version || 'Unknown', inline: true }
              ],
              footer: { text: 'Powered by mcsrvstat.us' },
              timestamp: new Date()
            };
            
            if (data.motd && data.motd.clean && data.motd.clean.length > 0) {
              serverEmbed.description = `**MOTD:**\n${data.motd.clean.join('\n')}`;
            }
            
            if (data.players && data.players.list && data.players.list.length > 0) {
              const playerList = data.players.list.slice(0, 20).join(', ');
              const hasMore = data.players.list.length > 20;
              
              serverEmbed.fields.push({
                name: 'Online Players',
                value: playerList + (hasMore ? '...' : '')
              });
            }
            
            await interaction.editReply({ embeds: [serverEmbed] });
          } catch (error) {
            console.error(error);
            await interaction.editReply({ 
              content: "Failed to fetch Minecraft server status. Please check the server address and try again.", 
              ephemeral: true 
            });
          }
          break;

        case "animal":
          try {
            await interaction.deferReply();
            const animalType = interaction.options.getString("type");
            
            const imageResponse = await axios.get(`https://some-random-api.com/animal/${animalType}`);
            const imageUrl = imageResponse.data.image;
            
            const animalEmbed = {
              color: 0x3498db,
              image: { url: imageUrl },
              footer: { text: 'Powered by some-random-api.com' },
              timestamp: new Date()
            };
            
            await interaction.editReply({ embeds: [animalEmbed] });
          } catch (error) {
            console.error(error);
            await interaction.editReply({ 
              content: "Failed to fetch animal image. The API might be down or the animal type is not available.", 
              ephemeral: true 
            });
          }
          break;

        case "anime":
          try {
            await interaction.deferReply();
            const type = interaction.options.getString("type");
            
            let apiUrl;
            let isQuote = false;
            
            if (type === "quote") {
              apiUrl = "https://some-random-api.ml/animu/quote";
              isQuote = true;
            } else {
              apiUrl = `https://some-random-api.ml/animu/${type}`;
            }
            
            const response = await axios.get(apiUrl);
            
            if (isQuote) {
              const quote = response.data.sentence;
              const character = response.data.character;
              const anime = response.data.anime;
              
              const quoteEmbed = {
                title: "Anime Quote",
                description: `"${quote}"`,
                fields: [
                  { name: "Character", value: character, inline: true },
                  { name: "Anime", value: anime, inline: true }
                ],
                color: 0xe74c3c,
                footer: { text: 'Powered by some-random-api.ml' },
                timestamp: new Date()
              };
              
              await interaction.editReply({ embeds: [quoteEmbed] });
            } else {
              const gifUrl = response.data.link;
              
              const actionTitle = type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
              
              const gifEmbed = {
                title: `Anime ${actionTitle}`,
                color: 0xe74c3c,
                image: { url: gifUrl },
                footer: { text: 'Powered by some-random-api.ml' },
                timestamp: new Date()
              };
              
              await interaction.editReply({ embeds: [gifEmbed] });
            }
          } catch (error) {
            console.error(error);
            await interaction.editReply({ 
              content: "Failed to fetch anime content. The API might be down or the requested action is not available.", 
              ephemeral: true 
            });
          }
          break;

        case "checkdns":
          try {
            await interaction.deferReply();
            const domain = interaction.options.getString("domain");
            const provider = interaction.options.getString("provider") || "1.1.1.1";
            
            const dns = require('dns');
            const resolver = new dns.Resolver();
            resolver.setServers([provider]);

            resolver.resolve4(domain, async (err, addresses) => {
              if (err) {
                const dnsEmbed = {
                  title: "DNS Lookup Result",
                  description: `Domain: ${domain}\nProvider: ${provider}`,
                  color: 0xFF0000,
                  fields: [
                    {
                      name: "Status",
                      value: "❌ Domain is blocked or unreachable",
                      inline: true
                    },
                    {
                      name: "Error",
                      value: err.code,
                      inline: true
                    }
                  ],
                  timestamp: new Date(),
                  footer: { text: "DNS Check Service" }
                };
                await interaction.editReply({ embeds: [dnsEmbed] });
              } else {
                const dnsEmbed = {
                  title: "DNS Lookup Result", 
                  description: `Domain: ${domain}\nProvider: ${provider}`,
                  color: 0x00FF00,
                  fields: [
                    {
                      name: "Status",
                      value: "✅ Domain is accessible",
                      inline: true
                    },
                    {
                      name: "IP Addresses",
                      value: addresses.join('\n'),
                      inline: true
                    }
                  ],
                  timestamp: new Date(),
                  footer: { text: "DNS Check Service" }
                };
                await interaction.editReply({ embeds: [dnsEmbed] });
              }
            });
          } catch (error) {
            console.error(error);
            await interaction.editReply({
              content: "Failed to perform DNS lookup. Please check the domain name and try again.",
              ephemeral: true
            });
          }
          break;

        case "traceroute":
          try {
            await interaction.deferReply();
            const target = interaction.options.getString("target");
            const maxHops = interaction.options.getInteger("hops") || 16;
            
            const { spawn } = require('child_process');
            // Use shell option to properly handle the pipe
            const tracepath = spawn('traceroute -q 1 -d -m ' + maxHops + ' ' + target + ' | awk \'{print $1, $2, $3}\'', {
              shell: true
            });
            
            let output = '';
            
            tracepath.stdout.on('data', async (data) => {
              const newData = data.toString()
                  .split('\n')
                  .map(line => line.trim())
                  .join('\n');
                  
              output += newData;
              const traceEmbed = {
                title: `Path to ${target}`,
                description: `\`\`\`\n${output}\`\`\``,
                color: 0x3498db,
                timestamp: new Date(),
                footer: { text: "Tracing..." }
              };
              
              await interaction.editReply({ embeds: [traceEmbed] });
            });
          
            tracepath.stderr.on('data', (data) => {
              console.log(`stderr: ${data}`);
            });
          
            tracepath.on('close', async () => {
              const finalEmbed = {
                title: `Path to ${target} - Complete`,
                description: `\`\`\`\n${output}\`\`\``,
                color: 0x00ff00,
                timestamp: new Date(),
                footer: { text: "✅ Trace complete" }
              };
              
              await interaction.editReply({ embeds: [finalEmbed] });
            });
          } catch (error) {
            console.error(error);
            await interaction.editReply({
              content: "Failed to trace path. Please check the target and try again.",
              ephemeral: true
            });
          }
          break;  

        case "whois":
          try {
            await interaction.deferReply();
            const domain = interaction.options.getString("domain");
            
            const result = await whois(domain);
            
            const whoisEmbed = {
              title: `WHOIS Lookup: ${domain}`,
              color: 0x2ecc71,
              fields: [
                {
                  name: "Registrar",
                  value: result.registrar || "Not available",
                  inline: true
                },
                {
                  name: "Creation Date",
                  value: result.creationDate ? new Date(result.creationDate).toLocaleDateString() : "Not available",
                  inline: true
                },
                {
                  name: "Expiration Date",
                  value: result.expirationDate ? new Date(result.expirationDate).toLocaleDateString() : "Not available",
                  inline: true
                },
                {
                  name: "Name Servers",
                  value: Array.isArray(result.nameServers) ? result.nameServers.join('\n') : "Not available"
                },
                {
                  name: "Status",
                  value: Array.isArray(result.status) ? result.status.join('\n') : (result.status || "Not available")
                }
              ],
              timestamp: new Date(),
              footer: { text: "Domain Information Service" }
            };
            
            await interaction.editReply({ embeds: [whoisEmbed] });
          } catch (error) {
            console.error(error);
            await interaction.editReply({
              content: "Failed to fetch WHOIS information. Please check the domain name and try again.",
              ephemeral: true
            });
          }
          break;

        case "stats":
          try {
            await interaction.deferReply();
            const os = require('os');
            
            // Calculate uptime
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            
            // Get system info
            const memUsage = process.memoryUsage();
            const cpuLoad = os.loadavg();
            
            const statsEmbed = {
              title: "Bot Statistics",
              color: 0x7289DA,
              fields: [
                {
                  name: "Bot Info",
                  value: [
                    `**Servers:** ${client.guilds.cache.size}`,
                    `**Users:** ${client.users.cache.size}`,
                    `**Channels:** ${client.channels.cache.size}`,
                    `**Commands:** ${globalCommands.length}`
                  ].join('\n'),
                  inline: true
                },
                {
                  name: "System Info",
                  value: [
                    `**Platform:** ${os.platform()}`,
                    `**Memory Usage:** ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                    `**CPU Load:** ${cpuLoad[0].toFixed(2)}%`,
                    `**Node.js:** ${process.version}`
                  ].join('\n'),
                  inline: true
                },
                {
                  name: "Uptime",
                  value: `${days}d ${hours}h ${minutes}m`,
                  inline: true
                }
              ],
              timestamp: new Date(),
              footer: { text: "blahaj-srv" }
            };
            
            await interaction.editReply({ embeds: [statsEmbed] });
          } catch (error) {
            console.error(error);
            await interaction.editReply({
              content: "Failed to fetch statistics.",
              ephemeral: true
            });
          }
          break;

        case "checkport":
          try {
            await interaction.deferReply();
            const target = interaction.options.getString("target");
            const ports = interaction.options.getString("ports").split(",").map(p => parseInt(p.trim()));
            const net = require('net');

            const checkPort = (port) => {
              return new Promise((resolve) => {
                const socket = new net.Socket();
                socket.setTimeout(2000); // 2 second timeout
                
                socket.on('connect', () => {
                  socket.destroy();
                  resolve({ port, status: 'open' });
                });
                
                socket.on('timeout', () => {
                  socket.destroy();
                  resolve({ port, status: 'closed' });
                });
                
                socket.on('error', () => {
                  socket.destroy();
                  resolve({ port, status: 'closed' });
                });
                
                socket.connect(port, target);
              });
            };

            const results = await Promise.all(ports.map(port => checkPort(port)));
            
            const scanEmbed = {
              title: `Port Scan Results for ${target}`,
              color: 0x00ff00,
              fields: results.map(result => ({
                name: `Port ${result.port}`,
                value: result.status === 'open' ? '🟢 Open' : '🔴 Closed',
                inline: true
              })),
              timestamp: new Date(),
              footer: { text: "Port Check" }
            };
            
            await interaction.editReply({ embeds: [scanEmbed] });
          } catch (error) {
            console.error(error);
            await interaction.editReply({
              content: "Failed to perform port scan. Please check the target and port numbers.",
              ephemeral: true
            });
          }
          break;

        default:
          await interaction.reply({ 
            content: `Command '${interaction.commandName}' not implemented yet.`, 
            ephemeral: true 
          });
      }
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      
      // Try to respond if we haven't already
      try {
        const replyMethod = interaction.deferred ? interaction.editReply : interaction.reply;
        await replyMethod.call(interaction, {
          content: "An error occurred while executing this command.",
          ephemeral: true
        });
      } catch (e) {
        console.error("Could not send error response:", e);
      }
    }
  } else if (interaction.isUserContextMenuCommand()) {
    // Handle user context menu commands
    if (interaction.commandName === "User Info") {
      const user = interaction.targetUser;
      
      const userInfoEmbed = {
        title: "User Information",
        color: 0x9B59B6,
        thumbnail: { url: user.displayAvatarURL({ dynamic: true }) },
        fields: [
          { name: "Username", value: user.username, inline: true },
          { name: "User ID", value: user.id, inline: true },
          { name: "Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
        ],
        footer: { text: "User Information" },
        timestamp: new Date()
      };
      
      await interaction.reply({ embeds: [userInfoEmbed], ephemeral: true });
    }
  }
});

// Handle guild join events to register guild-specific commands if needed
client.on("guildCreate", async (guild) => {
  console.log(`Joined new guild: ${guild.name} (${guild.id})`);
  
  if (guildCommands.length > 0) {
    try {
      console.log(`Registering guild commands for ${guild.name}...`);
      const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
      
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guild.id),
        { body: guildCommands }
      );
      console.log(`Successfully registered guild commands for ${guild.name}`);
    } catch (error) {
      console.error(`Error registering guild commands for ${guild.name}:`, error);
    }
  }
  
  // Notify owner if configured
  if (process.env.OWNER_ID) {
    try {
      const owner = await client.users.fetch(process.env.OWNER_ID);
      const guildJoinEmbed = {
        title: "New Guild Joined",
        color: 0x00ff00,
        fields: [
          { name: "Guild Name", value: guild.name, inline: true },
          { name: "Guild ID", value: guild.id, inline: true },
          { name: "Member Count", value: guild.memberCount.toString(), inline: true }
        ],
        timestamp: new Date(),
        footer: { text: "Guild Join Event" }
      };
      
      await owner.send({ embeds: [guildJoinEmbed] });
    } catch (error) {
      console.error("Failed to notify owner of guild join:", error);
    }
  }
});

// Error handling
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("Failed to login:", error);
  process.exit(1);
});
