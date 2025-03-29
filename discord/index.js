require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  ApplicationCommandOptionType,
  ApplicationCommandType
} = require("discord.js");
const axios = require("axios");
const ping = require("ping");

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
  

// Original slash commands
const slashCommands = [
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
  // Add Cody command
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
  // Add Weather command
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
  // Add Minecraft server status command
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
  // Add Anime commands
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

];

// User context menu commands
const userCommands = [
  {
    name: "User Info",
    type: ApplicationCommandType.User,
  },
];

const commands = [...slashCommands, ...userCommands];

async function updateCommands() {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error("Missing required environment variables: DISCORD_TOKEN or CLIENT_ID");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Fetching existing commands...");
    const existingCommands = await rest.get(Routes.applicationCommands(process.env.CLIENT_ID));

    // Delete all existing commands if needed
    // for (const command of existingCommands) {
    //   await rest.delete(`${Routes.applicationCommands(process.env.CLIENT_ID)}/${command.id}`);
    //   console.log(`Deleted command: ${command.name}`);
    // }

    // Register new commands (slash + user commands)
    console.log("Registering new commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("Commands updated successfully!");
  } catch (error) {
    console.error("Error updating commands:", error);
  }
}

// Function to ask Cody a question and parse the streaming response
async function askCody(question) {
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

    // Parse the streaming response
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
              // This is the full completion up to this point, not just an increment
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
}client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await updateCommands();

  const ownerId = process.env.OWNER_ID;
  const owner = await client.users.fetch(ownerId);
  await owner.send(`Bot started successfully at ${new Date().toLocaleString()}`);
});

client.on("interactionCreate", async (interaction) => {
    // Safe channel type logging
    console.log(`Interaction received in: ${interaction.channel?.type || 'Unknown channel type'}`);
    console.log(`Command name: ${interaction.commandName}`);
    console.log(`Channel: ${interaction.channel?.id || 'No channel'}`);
    
    // Rest of your existing handler code...
  });
  
  

client.on("interactionCreate", async (interaction) => {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
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
          await interaction.editReply({ content: `Ping: ${pingResult.time}ms` });
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
            for (const [server, data] of Object.entries(response.data)) {
              const status = data.online ? "online" : "offline";
              const responseTime = data.responseTime.toFixed(2);
              formattedResponse += `${server}: ${status}, response time: ${responseTime}ms\n`;
            }
            await interaction.reply({ content: formattedResponse });
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
        }        break;
        
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
        
// In the mcstatus command handler, replace the thumbnail section with this:
case "mcstatus":
  try {
    await interaction.deferReply();
    const serverAddress = interaction.options.getString("server");
    const isBedrock = interaction.options.getBoolean("bedrock") ?? false;
    
    // Determine which API endpoint to use based on server type
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
    
    // Create a rich embed for the server status
    const serverEmbed = {
      title: `Minecraft Server Status: ${serverAddress}`,
      color: 0x44FF44, // Green color
      // Use a default Minecraft image instead of trying to use the base64 icon
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
    
    // Add MOTD if available
    if (data.motd && data.motd.clean && data.motd.clean.length > 0) {
      serverEmbed.description = `**MOTD:**\n${data.motd.clean.join('\n')}`;
    }
    
    // Add player list if available and not empty
    if (data.players && data.players.list && data.players.list.length > 0) {
      // Limit to first 20 players to avoid hitting Discord's limits
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
    
    // Get animal image
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
    const action = interaction.options.getString("action");
    
    let apiUrl;
    let isQuote = false;
    
    if (action === "quote") {
      apiUrl = "https://some-random-api.ml/animu/quote";
      isQuote = true;
    } else {
      apiUrl = `https://some-random-api.ml/animu/${action}`;
    }
    
    const response = await axios.get(apiUrl);
    
    if (isQuote) {
      // Handle quote response
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
      // Handle GIF response
      const gifUrl = response.data.link;
      
      const actionTitle = action.charAt(0).toUpperCase() + action.slice(1).replace('-', ' ');
      
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
    }
}});
client.login(process.env.DISCORD_TOKEN);