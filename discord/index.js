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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
});

// Original slash commands
const slashCommands = [
  {
    name: "fetch_data",
    description: "Fetches data from an API",
    type: ApplicationCommandType.ChatInput,
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
    options: [
      {
        name: "location",
        description: "City name or postal code",
        type: ApplicationCommandOptionType.String,
        required: true,
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
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await updateCommands();
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
          
          // If the response is too long for Discord (which has a 2000 character limit)
          if (formattedResponse.length > 1900) {
            formattedResponse = formattedResponse.substring(0, 1900) + "...\n(Response truncated due to Discord's character limit)";
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
          
          const weatherUrl = `https://api.weatherapi.com/v1/forecast.json?key=${process.env.WEATHER_API_KEY}&q=${encodeURIComponent(location)}&aqi=no&days=1`;
          const response = await axios.get(weatherUrl);
          
          const data = response.data;
          const location_name = data.location.name;
          const region = data.location.region;
          const country = data.location.country;
          const localTime = data.location.localtime;
          const temp_c = data.current.temp_c;
          const temp_f = data.current.temp_f;
          const condition = data.current.condition.text;
          const humidity = data.current.humidity;
          const wind_kph = data.current.wind_kph;
          const wind_mph = data.current.wind_mph;
          const feelslike_c = data.current.feelslike_c;
          const feelslike_f = data.current.feelslike_f;
          const maxtemp_c = data.forecast.forecastday[0].day.maxtemp_c;
          const maxtemp_f = data.forecast.forecastday[0].day.maxtemp_f;
          const mintemp_c = data.forecast.forecastday[0].day.mintemp_c;
          const mintemp_f = data.forecast.forecastday[0].day.mintemp_f;
          
          const weatherEmbed = {
            title: `Weather for ${location_name}, ${region}, ${country}`,
            description: `Current condition: ${condition}\nLocal time: ${localTime}`,
            fields: [
              { name: 'Temperature', value: `${temp_c}°C / ${temp_f}°F`, inline: true },
              { name: 'Feels Like', value: `${feelslike_c}°C / ${feelslike_f}°F`, inline: true },
              { name: 'Humidity', value: `${humidity}%`, inline: true },
              { name: 'Wind Speed', value: `${wind_kph} km/h / ${wind_mph} mph`, inline: true },
              { name: 'Max Temperature', value: `${maxtemp_c}°C / ${maxtemp_f}°F`, inline: true },
              { name: 'Min Temperature', value: `${mintemp_c}°C / ${mintemp_f}°F`, inline: true }
            ],
            thumbnail: { url: `https:${data.current.condition.icon}` },
            timestamp: new Date(),
            footer: { text: 'Powered by WeatherAPI.com' }
          };
          
          await interaction.editReply({ embeds: [weatherEmbed] });
        } catch (error) {
          await interaction.editReply({ 
            content: "Failed to fetch weather data. Please check the location name and try again.", 
            ephemeral: true 
          });
        }
        break;
    }
  }

  // Handle user context menu commands
  else if (interaction.isUserContextMenuCommand()) {
    switch (interaction.commandName) {
      case "User Info":
        try {
          const user = interaction.targetUser;
          await interaction.reply({
            content: `User info:\n• Tag: ${user.tag}\n• ID: ${user.id}`,
            ephemeral: true,
          });
        } catch (error) {
          console.error(error);
          await interaction.reply({ content: "Failed to retrieve user info.", ephemeral: true });
        }
        break;
    }
  }
});

client.login(process.env.DISCORD_TOKEN);